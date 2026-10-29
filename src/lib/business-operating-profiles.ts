import { BUSINESS_CATEGORIES, categoryForActivity } from '@/lib/business-catalogue';

export type BusinessOperatingProfile = {
  businessType: string;
  catalogueLabel: string;
  primaryMode: 'products' | 'services' | 'mixed';
  modules: string[];
  workflows: string[];
  starterProducts: string[];
  starterServices: string[];
  operationalAreas: string[];
};

const includes = (s: string, ...terms: string[]) => terms.some(t => s.includes(t));
const product = (s: string) => ({
  retail: ['Products & variants', 'Barcode / SKU', 'Purchases & suppliers', 'Stock counts', 'Returns & exchanges'],
  food: ['Ingredients & recipes', 'Menu / prepared items', 'Wastage & expiry', 'Supplier purchases', 'Daily sales'],
  health: ['Medical supplies', 'Batch & expiry tracking', 'Supplier records', 'Restricted stock access', 'Billing'],
  farm: ['Farm inputs', 'Harvest / produce', 'Feed & consumables', 'Production costs', 'Sales'],
  auto: ['Spare parts', 'Lubricants & consumables', 'Parts usage per job', 'Supplier purchases', 'Stock movements'],
  build: ['Building materials', 'Project materials', 'Supplier deliveries', 'Material usage', 'Job costing'],
  production: ['Raw materials', 'Bill of materials', 'Production batches', 'Finished goods', 'Wastage'],
  general: ['Products & supplies', 'Purchases', 'Stock counts', 'Low-stock alerts', 'Sales']
}[s] || ['Products & supplies', 'Purchases', 'Stock counts', 'Low-stock alerts', 'Sales']);

export function getBusinessOperatingProfile(businessType: string): BusinessOperatingProfile {
  const s = businessType.toLowerCase();
  const category = categoryForActivity(businessType);
  let primaryMode: BusinessOperatingProfile['primaryMode'] = category?.serviceFirst ? 'mixed' : 'products';
  let modules = ['sales', 'expenses', 'customers', 'staff', 'reports'];
  let workflows = ['Sales and payment records', 'Customer history', 'Expense tracking', 'Staff access and activity', 'Daily and period reports'];
  let starterProducts = ['General product', 'Consumable', 'Accessory'];
  let starterServices: string[] = [];
  let operationalAreas: string[] = ['Sales', 'Customers', 'Expenses', 'Staff'];

  if (includes(s,'salon','barber','beauty parlour','braiding','dreadlock','nail studio','massage','spa','makeup','tattoo')) {
    primaryMode='mixed'; modules.push('inventory','appointments','service_catalogue','staff_commissions');
    starterProducts=['Shampoo','Conditioner','Hair treatment','Hair extensions','Nail polish','Beauty consumables'];
    starterServices=['Haircut','Wash & blow-dry','Braiding','Retouch','Manicure','Pedicure','Massage session','Makeup application'];
    workflows=['Service menu with duration and price','Appointment calendar and walk-in queue','Customer visit and style notes','Staff assignment and commission tracking','Retail products and consumables stock','Deposits, balances and receipts'];
    operationalAreas=['Services & prices','Appointments','Customer history','Staff & commissions','Retail products','Payments'];
  } else if (includes(s,'restaurant','fast-food','café','coffee','juice','catering','bar and entertainment','hotel','guesthouse','lodge','bakery','cake shop')) {
    primaryMode='mixed'; modules.push('inventory','menu','orders','recipes','bookings');
    starterProducts=['Rice','Cooking oil','Flour','Milk','Sugar','Chicken','Soft drinks','Bottled water','Packaging'];
    starterServices=['Dine-in order','Takeaway order','Delivery fee','Outside catering','Table reservation'];
    workflows=['Menu with categories and modifiers','Table, takeaway and delivery orders','Ingredient recipes and automatic stock usage','Kitchen order preparation status','Wastage and daily closing','Reservations and event enquiries'];
    operationalAreas=['Menu & prices','Orders / tables','Kitchen','Ingredients & recipes','Reservations','Wastage'];
  } else if (includes(s,'butchery','poultry','fish shop','greengrocery','fruit','cereals','agrovet','animal feeds','farm produce')) {
    primaryMode='products'; modules.push('inventory','weighing','batches','suppliers');
    starterProducts=['Fresh produce','Rice','Beans','Maize flour','Cooking oil','Chicken','Beef','Fish','Animal feed','Seeds'];
    workflows=['Weight-based and unit-based selling','Supplier and purchase records','Batch and expiry tracking where relevant','Spoilage / wastage records','Daily stock reconciliation'];
    operationalAreas=['Weighted products','Purchases','Suppliers','Wastage','Stock counts'];
  } else if (includes(s,'pharmacy','hospital','medical','dental','eye clinic','optical','laboratory','veterinary','maternity','physiotherapy')) {
    primaryMode='mixed'; modules.push('inventory','appointments','service_catalogue','batches','expiry');
    starterProducts=['Bandages','Disposable gloves','First-aid supplies','Approved OTC item','Medical consumables'];
    starterServices=['Consultation','Review visit','Laboratory test','Dental procedure','Eye examination','Physiotherapy session'];
    workflows=['Service and billing catalogue','Appointments and visit queue','Batch numbers and expiry alerts for stock','Restricted staff roles and audit trail','Supplier and expense tracking'];
    operationalAreas=['Services & billing','Appointments','Medical supplies','Expiry / batches','Restricted staff access'];
  } else if (includes(s,'garage','car wash','tyre','auto spare','motorbike repair','vehicle dealership','vehicle inspection','machinery repair','car detailing','welding','fabrication')) {
    primaryMode='mixed'; modules.push('inventory','job_cards','service_catalogue','vehicle_records');
    starterProducts=['Engine oil','Oil filter','Brake pads','Tyre','Spark plug','Cleaning supplies'];
    starterServices=['Vehicle diagnosis','Service labour','Oil change','Tyre fitting','Wheel alignment','Car wash','Panel beating'];
    workflows=['Vehicle/customer job cards','Inspection checklist and job status','Labour and parts on one invoice','Record parts consumed per job','Vehicle history and service notes'];
    operationalAreas=['Job cards','Vehicles','Repair services','Spare parts','Mechanics & assignments'];
  } else if (includes(s,'taxi','ride-hailing','car hire','matatu','bus operator','school transport','courier','logistics','freight','moving','trucking','motorcycle delivery')) {
    primaryMode='services'; modules.push('fleet','trips','dispatch','fuel_log');
    starterServices=['Local trip','Long-distance trip','Airport transfer','Delivery fee','Vehicle hire','Parcel delivery'];
    workflows=['Trip / delivery booking and status','Vehicle and driver allocation','Route and mileage records','Fuel and vehicle expense log','Customer invoices and receipts'];
    operationalAreas=['Trips & bookings','Fleet & drivers','Dispatch','Fuel / maintenance','Customer billing'];
  } else if (includes(s,'school','college','university','training centre','driving school','tuition','coaching','kindergarten','nursery')) {
    primaryMode='mixed'; modules.push('enrolments','courses','timetable','fee_items');
    starterProducts=['Exercise books','Pens','Textbooks','Uniform','Learning materials'];
    starterServices=['Registration fee','Tuition fee','Training session','Examination fee','Certificate fee'];
    workflows=['Learner/customer enrolment records','Courses and fee items','Class / lesson timetable','Fee payments and balances','Role-restricted access to personal records'];
    operationalAreas=['Enrolments','Courses & fees','Timetable','Learning materials','Payments'];
  } else if (includes(s,'gym','fitness','sports academy','gaming','entertainment centre','pet grooming','funeral services')) {
    primaryMode='services'; modules.push('memberships','sessions','bookings');
    starterProducts=['Water','Sports accessories','Consumables','Pet care products'];
    starterServices=['Monthly membership','Day pass','Personal training','Group class','Equipment hire','Grooming session'];
    workflows=['Membership plans and renewals','Session / class bookings','Attendance and check-ins','Trainer or service-provider allocation','Retail add-ons and receipts'];
    operationalAreas=['Memberships','Bookings & sessions','Attendance','Staff','Add-on products'];
  } else if (includes(s,'hotel','hostel','short-stay','bed and breakfast','rental property','property management','equipment rental','furniture and appliance rental','conference','venue hire','event planning','wedding','tour and travel')) {
    primaryMode='mixed'; modules.push('bookings','rental_units','calendar','service_catalogue');
    starterProducts=['Guest amenities','Cleaning supplies','Bedding','Event consumables'];
    starterServices=['Room / unit booking','Venue hire','Equipment hire','Cleaning fee','Event package','Tour package'];
    workflows=['Availability calendar and reservations','Check-in / check-out or hire periods','Deposits, balances and refunds','Asset / room condition tracking','Cleaning and maintenance tasks'];
    operationalAreas=['Bookings calendar','Rooms / assets','Check-in & check-out','Deposits & payments','Cleaning / maintenance'];
  } else if (includes(s,'manufactur','factory','garment','tailoring','soap','detergent','water bottling','plastics','packaging','food processing')) {
    primaryMode='mixed'; modules.push('inventory','production','batches','bill_of_materials');
    starterProducts=['Raw materials','Packaging material','Finished product','Production supplies'];
    starterServices=['Custom production order','Tailoring alteration','Packaging service'];
    workflows=['Raw material and finished goods catalogue','Bill of materials / recipes','Production batches and quantities','Material consumption and wastage','Finished goods stock and costing'];
    operationalAreas=['Raw materials','Production orders','Batches','Finished goods','Wastage'];
  } else if (includes(s,'construction','plumbing','electrical installation','painting','roofing','interior design','real estate','building consultancy','quantity surveying')) {
    primaryMode='mixed'; modules.push('projects','job_costing','inventory','service_catalogue');
    starterProducts=['Cement 50kg','Nails','Roofing sheets','PVC pipe','Paint','Electrical cable'];
    starterServices=['Site inspection','Installation labour','Repair labour','Project management','Consultation'];
    workflows=['Customer projects and quotations','Project-specific material allocation','Labour and subcontractor costs','Progress and payment milestones','Material purchase and usage'];
    operationalAreas=['Projects','Quotations','Materials','Labour & subcontractors','Project costs'];
  } else if (includes(s,'accounting','bookkeeping','law firm','consultancy','marketing','advertising','recruitment','cleaning services','photography','videography','recording studio','social media','software development','web design','graphic design','printing','photocopy','cybercafé','internet service','computer repair')) {
    primaryMode='services'; modules.push('service_catalogue','projects','appointments');
    starterProducts=['A4 paper','Printer ink / toner','USB flash drive','Office supplies'];
    starterServices=['Consultation','Hourly service','Project package','Black & white printing','Color printing','Photocopying','Scanning','Photography session','Design fee','Repair labour'];
    workflows=['Service price list and packages','Client projects and milestones','Appointments / work schedule','Track billable work and expenses','Client invoices and receipts'];
    operationalAreas=['Services & packages','Client projects','Appointments','Consumables','Invoices'];
  } else if (includes(s,'insurance','sacco','cooperative','financial','rental','repair and maintenance')) {
    primaryMode='services'; modules.push('service_catalogue','contracts','asset_register');
    starterProducts=['Office supplies','Equipment','Consumables'];
    starterServices=['Consultation','Membership fee','Administration fee','Equipment hire','Maintenance call-out'];
    workflows=['Customer / member register','Service agreements and renewal dates','Payment schedules and receipts','Asset register for rentals','Restricted access and audit trail'];
    operationalAreas=['Members / customers','Agreements','Schedules','Assets','Payments'];
  } else {
    const group = category || BUSINESS_CATEGORIES[0];
    primaryMode = group?.serviceFirst ? 'mixed' : 'products';
    if (group?.inventory) modules.push('inventory');
    starterProducts = group?.inventory ? ['General product','Supplies','Consumable','Accessory'] : [];
    starterServices = group?.serviceFirst ? ['Service fee','Consultation','Labour charge'] : [];
    workflows = [...(group?.workflows || workflows), 'Custom fields and catalogue entries can be added by the owner'];
    operationalAreas = [...(group?.setup || ['Sales','Expenses','Customers','Staff'])];
  }
  if (category?.privacySensitive) workflows.push('Use least-privilege staff access; specialist regulated records require a dedicated compliant workflow.');
  return { businessType, catalogueLabel: primaryMode === 'services' ? 'Services' : primaryMode === 'mixed' ? 'Products & services' : 'Products', primaryMode, modules: [...new Set(modules)], workflows, starterProducts, starterServices, operationalAreas };
}
