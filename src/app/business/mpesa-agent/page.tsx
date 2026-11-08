import { redirect } from 'next/navigation';

export default function LegacyMpesaAgentRoute() {
  redirect('/admin/sales');
}
