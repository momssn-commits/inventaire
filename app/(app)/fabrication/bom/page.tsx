import { redirect } from 'next/navigation';

// Les nomenclatures sont dans /fabrication (onglet BOM en bas de page)
export default function BomRedirect() {
  redirect('/fabrication');
}
