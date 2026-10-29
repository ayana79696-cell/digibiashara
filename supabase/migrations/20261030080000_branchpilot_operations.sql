-- BranchPilot operational layer. Additive migration: keeps existing DigiBiashara business setup and platform administration.
alter table public.branches
  add column if not exists opening_time time,
  add column if not exists closing_time time,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists attendance_radius_m integer not null default 150
    check (attendance_radius_m between 25 and 5000);

alter table public.products
  add column if not exists size text,
  add column if not exists color text,
  add column if not exists image_url text,
  add column if not exists archived_at timestamptz;

alter table public.sales
  add column if not exists employee_id uuid;
alter table public.payments
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists employee_id uuid;
alter table public.stock_movements
  add column if not exists employee_id uuid;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  full_name text not null,
  email text not null,
  phone text,
  role text not null default 'cashier',
  is_active boolean not null default true,
  scheduled_start time,
  scheduled_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id),
  constraint employees_role_check check (role in ('manager','cashier','stock_manager','accountant','custom')),
  constraint employees_branch_business_match check (business_id is not null)
);
create index if not exists employees_branch_active_idx on public.employees(business_id,branch_id,is_active);
create index if not exists employees_user_active_idx on public.employees(user_id,is_active);

create table if not exists public.branch_inventory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  opening_stock numeric(14,3) not null default 0 check (opening_stock >= 0),
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (business_id,branch_id,product_id)
);
create index if not exists branch_inventory_lookup_idx on public.branch_inventory(business_id,branch_id,product_id);

-- Seed the existing global stock into the first branch per business to avoid duplicating it across multiple branches.
with ranked_branches as (
  select b.id,b.business_id,row_number() over(partition by b.business_id order by b.created_at,b.id) as rn
  from public.branches b where b.is_active = true
)
insert into public.branch_inventory(business_id,branch_id,product_id,opening_stock,quantity)
select p.business_id,rb.id,p.id,
       case when p.branch_id=rb.id or (p.branch_id is null and rb.rn=1) then greatest(coalesce(p.quantity,0),0) else 0 end,
       case when p.branch_id=rb.id or (p.branch_id is null and rb.rn=1) then greatest(coalesce(p.quantity,0),0) else 0 end
from public.products p
join ranked_branches rb on rb.business_id=p.business_id
on conflict (business_id,branch_id,product_id) do nothing;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  check_in_latitude double precision,
  check_in_longitude double precision,
  check_in_accuracy_m double precision,
  check_out_latitude double precision,
  check_out_longitude double precision,
  check_out_accuracy_m double precision,
  scheduled_start time,
  late_minutes integer not null default 0 check (late_minutes >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists attendance_one_open_shift_per_employee
on public.attendance(employee_id) where check_out_at is null;
create index if not exists attendance_business_date_idx on public.attendance(business_id,check_in_at desc);

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  from_branch_id uuid not null references public.branches(id) on delete restrict,
  to_branch_id uuid not null references public.branches(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','in_transit','received','cancelled')),
  transfer_number text not null,
  notes text,
  created_by uuid not null references auth.users(id),
  received_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  received_at timestamptz,
  check (from_branch_id <> to_branch_id),
  unique (business_id,transfer_number)
);
create table if not exists public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  transfer_id uuid not null references public.stock_transfers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.mpesa_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  sale_id uuid not null references public.sales(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  transaction_code text not null,
  amount numeric(14,2) not null check (amount > 0),
  recorded_by uuid not null references auth.users(id),
  transaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id,transaction_code),
  unique (payment_id)
);
create index if not exists mpesa_transactions_search_idx on public.mpesa_transactions(business_id,transaction_at desc);
create index if not exists mpesa_transactions_branch_idx on public.mpesa_transactions(branch_id,transaction_at desc);

-- Enforce that an employee's branch belongs to the same business.
create or replace function private.branchpilot_employee_branch_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.branches b
    where b.id=new.branch_id and b.business_id=new.business_id
  ) then raise exception 'The selected branch does not belong to this business.'; end if;
  return new;
end; $$;
drop trigger if exists branchpilot_employee_branch_guard on public.employees;
create trigger branchpilot_employee_branch_guard before insert or update of business_id,branch_id
on public.employees for each row execute function private.branchpilot_employee_branch_guard();

create or replace function public.record_branchpilot_sale(
  p_business_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_amount_paid numeric,
  p_discount numeric default 0,
  p_notes text default null,
  p_mpesa_code text default null,
  p_branch_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_membership public.business_memberships%rowtype;
  v_employee public.employees%rowtype;
  v_branch uuid := p_branch_id;
  v_employee_id uuid;
  v_receipt text := 'BP-' || to_char(now() at time zone 'Africa/Nairobi','YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  v_sale_id uuid;
  v_payment_id uuid;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2);
  v_paid numeric(14,2) := coalesce(p_amount_paid,0);
  v_discount numeric(14,2) := coalesce(p_discount,0);
  v_payment_status text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty numeric(14,3);
  v_available numeric(14,3);
  v_stock_row public.branch_inventory%rowtype;
  v_line_total numeric(14,2);
  v_note text := p_notes;
  v_cash_tendered numeric(14,2);
  v_change_due numeric(14,2) := 0;
  v_count integer := 0;
  v_code text := nullif(upper(regexp_replace(coalesce(p_mpesa_code,''),'\s+','','g')),'');
begin
  if v_user is null then raise exception 'Sign in is required.'; end if;
  select * into v_membership from public.business_memberships
  where business_id=p_business_id and user_id=v_user and is_active=true limit 1;
  if not found then raise exception 'You do not have access to this business.'; end if;
  if not private.has_business_permission(p_business_id,'record_sales') then
    raise exception 'You do not have permission to record sales for this business.';
  end if;

  select * into v_employee from public.employees
  where business_id=p_business_id and user_id=v_user and is_active=true limit 1;
  if found then
    v_branch := v_employee.branch_id;
    v_employee_id := v_employee.id;
  elsif lower(v_membership.role) not in ('owner','business_owner','admin','manager') then
    raise exception 'An active branch assignment is required before recording sales.';
  end if;
  if v_branch is not null and not exists (
    select 1 from public.branches where id=v_branch and business_id=p_business_id and is_active=true
  ) then raise exception 'Select an active branch belonging to this business.'; end if;
  if v_branch is null then raise exception 'Choose a branch before recording this sale.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one item to the sale.'; end if;
  if p_payment_method not in ('cash','mpesa','card','bank','credit','other') then raise exception 'Select a valid payment method.'; end if;
  if v_paid < 0 or v_discount < 0 then raise exception 'Payment and discount cannot be negative.'; end if;
  if p_payment_method='mpesa' and v_paid>0 and v_code is null then
    raise exception 'Enter the M-Pesa transaction code before completing this payment.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := nullif(v_item->>'quantity','')::numeric;
    if v_qty is null or v_qty<=0 then raise exception 'Each item quantity must be greater than zero.'; end if;
    select * into v_product from public.products
    where id=(v_item->>'product_id')::uuid and business_id=p_business_id and is_active=true and archived_at is null for update;
    if not found then raise exception 'A selected product was not found in this business.'; end if;
    select sum((value->>'quantity')::numeric) into v_available
      from jsonb_array_elements(p_items) where value->>'product_id'=v_item->>'product_id';
    if v_product.unit <> 'service' then
      select * into v_stock_row from public.branch_inventory
      where business_id=p_business_id and branch_id=v_branch and product_id=v_product.id for update;
      if not found then raise exception 'Stock has not been initialized for % at this branch. Ask the owner to set opening stock.',v_product.name; end if;
      if v_stock_row.quantity < v_available then
        raise exception 'Insufficient stock for % at this branch (available: %, requested: %).',v_product.name,v_stock_row.quantity,v_available;
      end if;
    end if;
    v_subtotal := v_subtotal + (v_qty*v_product.selling_price);
    v_count := v_count+1;
  end loop;
  if v_count>100 then raise exception 'A sale cannot contain more than 100 line items.'; end if;
  if v_discount>v_subtotal then raise exception 'Discount cannot exceed the subtotal.'; end if;
  v_total := v_subtotal-v_discount;
  if v_paid>v_total then raise exception 'Amount paid cannot exceed the sale total.'; end if;
  v_payment_status := case when v_paid=0 then 'unpaid' when v_paid<v_total then 'partial' else 'paid' end;

  insert into public.sales(business_id,branch_id,employee_id,receipt_number,sold_by,subtotal,discount,total,amount_paid,payment_status,sale_status,notes)
  values(p_business_id,v_branch,v_employee_id,v_receipt,v_user,v_subtotal,v_discount,v_total,v_paid,v_payment_status,'completed',v_note)
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::numeric;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and business_id=p_business_id for update;
    v_line_total := round(v_qty*v_product.selling_price,2);
    insert into public.sale_items(business_id,sale_id,product_id,product_name,quantity,unit_price,unit_cost,line_discount,line_total)
    values(p_business_id,v_sale_id,v_product.id,v_product.name,v_qty,v_product.selling_price,v_product.cost_price,0,v_line_total);
    if v_product.unit <> 'service' then
      update public.branch_inventory set quantity=quantity-v_qty,updated_at=now()
      where business_id=p_business_id and branch_id=v_branch and product_id=v_product.id;
      update public.products p set quantity=coalesce((
        select sum(bi.quantity) from public.branch_inventory bi
        where bi.business_id=p.business_id and bi.product_id=p.id
      ),0),updated_at=now() where p.id=v_product.id;
      insert into public.stock_movements(business_id,branch_id,product_id,employee_id,movement_type,quantity_change,reference,notes,created_by)
      values(p_business_id,v_branch,v_product.id,v_employee_id,'sale',-v_qty,v_receipt,'Stock deducted for BranchPilot sale',v_user);
    end if;
  end loop;

  if v_paid>0 then
    insert into public.payments(business_id,sale_id,branch_id,employee_id,recorded_by,amount,method,reference,status,paid_at,metadata)
    values(p_business_id,v_sale_id,v_branch,v_employee_id,v_user,v_paid,p_payment_method,
      case when p_payment_method='mpesa' then v_code else null end,'recorded',now(),
      jsonb_build_object('receipt_number',v_receipt))
    returning id into v_payment_id;
    if p_payment_method='mpesa' then
      insert into public.mpesa_transactions(business_id,branch_id,employee_id,sale_id,payment_id,transaction_code,amount,recorded_by,transaction_at)
      values(p_business_id,v_branch,v_employee_id,v_sale_id,v_payment_id,v_code,v_paid,v_user,now());
    end if;
  end if;

  insert into public.audit_logs(business_id,actor_user_id,action,entity_type,entity_id,details)
  values(p_business_id,v_user,'sale_recorded','sale',v_sale_id::text,
    jsonb_build_object('receipt_number',v_receipt,'branch_id',v_branch,'employee_id',v_employee_id,'total',v_total,'amount_paid',v_paid,'payment_method',p_payment_method,'mpesa_code',v_code));
  return jsonb_build_object('sale_id',v_sale_id,'receipt_number',v_receipt,'subtotal',v_subtotal,'discount',v_discount,'total',v_total,'amount_paid',v_paid,'payment_status',v_payment_status,'branch_id',v_branch,'employee_id',v_employee_id,'mpesa_code',v_code);
end;
$$;
revoke all on function public.record_branchpilot_sale(uuid,jsonb,text,numeric,numeric,text,text,uuid) from public, anon;
grant execute on function public.record_branchpilot_sale(uuid,jsonb,text,numeric,numeric,text,text,uuid) to authenticated;

create or replace function public.branchpilot_check_attendance(
  p_action text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_m double precision default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_employee public.employees%rowtype;
  v_branch public.branches%rowtype;
  v_attendance public.attendance%rowtype;
  v_distance double precision;
  v_late integer := 0;
begin
  if v_user is null then raise exception 'Sign in is required.'; end if;
  select * into v_employee from public.employees where user_id=v_user and is_active=true limit 1;
  if not found then raise exception 'This login is not assigned to an active employee profile.'; end if;
  select * into v_branch from public.branches where id=v_employee.branch_id and business_id=v_employee.business_id and is_active=true;
  if not found then raise exception 'Your assigned branch is inactive or unavailable.'; end if;

  if p_action='check_in' then
    if exists(select 1 from public.attendance where employee_id=v_employee.id and check_out_at is null) then
      raise exception 'You are already checked in. Check out the current shift first.';
    end if;
    if v_branch.latitude is not null and v_branch.longitude is not null then
      if p_latitude is null or p_longitude is null then raise exception 'Allow location access to check in at this branch.'; end if;
      v_distance := 6371000*2*asin(sqrt(
        power(sin(radians(p_latitude-v_branch.latitude)/2),2)+
        cos(radians(v_branch.latitude))*cos(radians(p_latitude))*power(sin(radians(p_longitude-v_branch.longitude)/2),2)
      ));
      if v_distance > v_branch.attendance_radius_m then raise exception 'You are outside this branch attendance radius (% metres away).',round(v_distance)::integer; end if;
    end if;
    if v_employee.scheduled_start is not null then
      v_late := greatest(0,floor(extract(epoch from ((now() at time zone 'Africa/Nairobi')::time-v_employee.scheduled_start))/60)::integer);
    end if;
    insert into public.attendance(business_id,branch_id,employee_id,user_id,check_in_at,check_in_latitude,check_in_longitude,check_in_accuracy_m,scheduled_start,late_minutes)
    values(v_employee.business_id,v_employee.branch_id,v_employee.id,v_user,now(),p_latitude,p_longitude,p_accuracy_m,v_employee.scheduled_start,v_late)
    returning * into v_attendance;
    if v_late>0 then
      insert into public.audit_logs(business_id,actor_user_id,action,entity_type,entity_id,details)
      values(v_employee.business_id,v_user,'employee_late_check_in','attendance',v_attendance.id::text,jsonb_build_object('late_minutes',v_late,'branch_id',v_employee.branch_id));
    end if;
  elsif p_action='check_out' then
    select * into v_attendance from public.attendance
      where employee_id=v_employee.id and check_out_at is null order by check_in_at desc limit 1 for update;
    if not found then raise exception 'No open shift found. Check in before checking out.'; end if;
    update public.attendance set check_out_at=now(),check_out_latitude=p_latitude,check_out_longitude=p_longitude,check_out_accuracy_m=p_accuracy_m
      where id=v_attendance.id returning * into v_attendance;
  else raise exception 'Choose check_in or check_out.'; end if;

  return jsonb_build_object('id',v_attendance.id,'check_in_at',v_attendance.check_in_at,'check_out_at',v_attendance.check_out_at,'late_minutes',v_attendance.late_minutes,'branch_id',v_attendance.branch_id);
end; $$;
revoke all on function public.branchpilot_check_attendance(text,double precision,double precision,double precision) from public, anon;
grant execute on function public.branchpilot_check_attendance(text,double precision,double precision,double precision) to authenticated;

create or replace function public.branchpilot_adjust_stock(
  p_branch_id uuid,p_product_id uuid,p_quantity_change numeric,p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid:=auth.uid(); v_employee public.employees%rowtype; v_business uuid; v_current numeric;
begin
  if v_user is null then raise exception 'Sign in is required.'; end if;
  select e.* into v_employee from public.employees e where e.user_id=v_user and e.is_active=true limit 1;
  if v_employee.id is not null then
    if v_employee.branch_id<>p_branch_id then raise exception 'Employees can only adjust their assigned branch stock.'; end if;
    raise exception 'Only an owner or authorized stock manager may adjust stock.';
  end if;
  select business_id into v_business from public.branches where id=p_branch_id and is_active=true;
  if v_business is null or not private.has_business_permission(v_business,'manage_stock') then raise exception 'You do not have permission to adjust this branch stock.'; end if;
  if coalesce(trim(p_reason),'')='' or coalesce(p_quantity_change,0)=0 then raise exception 'Enter a non-zero adjustment and a reason.'; end if;
  select quantity into v_current from public.branch_inventory where business_id=v_business and branch_id=p_branch_id and product_id=p_product_id for update;
  if not found then raise exception 'No stock record exists for this product at this branch.'; end if;
  if v_current+p_quantity_change<0 then raise exception 'Adjustment would make stock negative.'; end if;
  update public.branch_inventory set quantity=quantity+p_quantity_change,updated_at=now() where business_id=v_business and branch_id=p_branch_id and product_id=p_product_id;
  update public.products p set quantity=(select coalesce(sum(bi.quantity),0) from public.branch_inventory bi where bi.business_id=p.business_id and bi.product_id=p.id),updated_at=now() where p.id=p_product_id and p.business_id=v_business;
  insert into public.stock_movements(business_id,branch_id,product_id,movement_type,quantity_change,notes,created_by)
  values(v_business,p_branch_id,p_product_id,'adjustment',p_quantity_change,trim(p_reason),v_user);
  insert into public.audit_logs(business_id,actor_user_id,action,entity_type,entity_id,details)
  values(v_business,v_user,'stock_adjustment','product',p_product_id::text,jsonb_build_object('branch_id',p_branch_id,'quantity_change',p_quantity_change,'reason',trim(p_reason)));
  return jsonb_build_object('success',true,'quantity',v_current+p_quantity_change);
end; $$;
revoke all on function public.branchpilot_adjust_stock(uuid,uuid,numeric,text) from public, anon;
grant execute on function public.branchpilot_adjust_stock(uuid,uuid,numeric,text) to authenticated;

-- New BranchPilot tables always use RLS. Keep existing platform/admin policies and routes unchanged.
alter table public.employees enable row level security;
alter table public.branch_inventory enable row level security;
alter table public.attendance enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
alter table public.mpesa_transactions enable row level security;

drop policy if exists branchpilot_employees_select on public.employees;
create policy branchpilot_employees_select on public.employees for select to authenticated
using (user_id=auth.uid() or private.has_business_permission(business_id,'manage_staff'));
drop policy if exists branchpilot_employees_owner_manage on public.employees;
create policy branchpilot_employees_owner_manage on public.employees for all to authenticated
using (private.has_business_permission(business_id,'manage_staff'))
with check (private.has_business_permission(business_id,'manage_staff'));

drop policy if exists branchpilot_inventory_select on public.branch_inventory;
create policy branchpilot_inventory_select on public.branch_inventory for select to authenticated
using (
  private.has_business_permission(business_id,'manage_stock')
  or exists(select 1 from public.employees e where e.business_id=branch_inventory.business_id and e.user_id=auth.uid() and e.branch_id=branch_inventory.branch_id and e.is_active=true)
);
drop policy if exists branchpilot_inventory_owner_manage on public.branch_inventory;
create policy branchpilot_inventory_owner_manage on public.branch_inventory for all to authenticated
using (private.has_business_permission(business_id,'manage_stock'))
with check (private.has_business_permission(business_id,'manage_stock'));

drop policy if exists branchpilot_attendance_select on public.attendance;
create policy branchpilot_attendance_select on public.attendance for select to authenticated
using (user_id=auth.uid() or private.has_business_permission(business_id,'manage_staff'));
drop policy if exists branchpilot_attendance_employee_insert on public.attendance;
create policy branchpilot_attendance_employee_insert on public.attendance for insert to authenticated
with check (user_id=auth.uid() and exists(select 1 from public.employees e where e.id=attendance.employee_id and e.user_id=auth.uid() and e.branch_id=attendance.branch_id and e.business_id=attendance.business_id and e.is_active=true));
drop policy if exists branchpilot_attendance_employee_update on public.attendance;
create policy branchpilot_attendance_employee_update on public.attendance for update to authenticated
using (user_id=auth.uid() and check_out_at is null)
with check (user_id=auth.uid());

drop policy if exists branchpilot_transfer_owner_access on public.stock_transfers;
create policy branchpilot_transfer_owner_access on public.stock_transfers for all to authenticated
using (private.has_business_permission(business_id,'manage_stock'))
with check (private.has_business_permission(business_id,'manage_stock'));
drop policy if exists branchpilot_transfer_items_owner_access on public.stock_transfer_items;
create policy branchpilot_transfer_items_owner_access on public.stock_transfer_items for all to authenticated
using (private.has_business_permission(business_id,'manage_stock'))
with check (private.has_business_permission(business_id,'manage_stock'));

drop policy if exists branchpilot_mpesa_select on public.mpesa_transactions;
create policy branchpilot_mpesa_select on public.mpesa_transactions for select to authenticated
using (
  private.has_business_permission(business_id,'view_payments')
  or exists(select 1 from public.employees e where e.business_id=mpesa_transactions.business_id and e.user_id=auth.uid() and e.id=mpesa_transactions.employee_id and e.branch_id=mpesa_transactions.branch_id and e.is_active=true)
);
drop policy if exists branchpilot_mpesa_insert on public.mpesa_transactions;
create policy branchpilot_mpesa_insert on public.mpesa_transactions for insert to authenticated
with check (recorded_by=auth.uid() and private.has_business_permission(business_id,'record_sales'));

grant select on public.employees,public.branch_inventory,public.attendance,public.stock_transfers,public.stock_transfer_items,public.mpesa_transactions to authenticated;
