import { ScanLine } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { WarehouseModeClient } from '@/components/WarehouseModeClient';

export default function BarcodePage() {
  return (
    <div>
      <PageHeader
        title="Mode entrepôt"
        subtitle="Interface plein écran optimisée pour scan codes-barres et opérations en entrepôt"
        module="M5"
      />

      <div className="card p-3 mb-4 bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Compatibilité :</strong> Scanners USB, Bluetooth, et caméra de smartphone (PWA).
          Reconnaît les standards EAN-13, UPC-A, Code-128, QR Code et la nomenclature internationale GS1
          avec décodage automatique des Application Identifiers (AI 01, 10, 17, 21, 30).
        </p>
      </div>

      <WarehouseModeClient />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ScanLine className="size-4" />
            <h3 className="font-semibold">Application Identifiers GS1 supportés</h3>
          </div>
          <table className="table-base">
            <thead>
              <tr>
                <th>AI</th>
                <th>Signification</th>
                <th>Exemple</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="font-mono">(01)</td><td className="text-sm">Identifiant produit (GTIN)</td><td className="font-mono text-xs">(01)03012345678900</td></tr>
              <tr><td className="font-mono">(10)</td><td className="text-sm">Numéro de lot</td><td className="font-mono text-xs">(10)LOT2026-A</td></tr>
              <tr><td className="font-mono">(17)</td><td className="text-sm">Date de péremption</td><td className="font-mono text-xs">(17)261231</td></tr>
              <tr><td className="font-mono">(21)</td><td className="text-sm">Numéro de série</td><td className="font-mono text-xs">(21)SN0001</td></tr>
              <tr><td className="font-mono">(30)</td><td className="text-sm">Quantité variable</td><td className="font-mono text-xs">(30)42</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-3">Codes-barres de test</h3>
          <p className="text-xs text-zinc-500 mb-3">Saisissez ou collez ces codes pour tester le décodage :</p>
          <ul className="space-y-2">
            <li className="font-mono text-xs p-2 bg-zinc-50 dark:bg-zinc-900 rounded">3012345678901</li>
            <li className="font-mono text-xs p-2 bg-zinc-50 dark:bg-zinc-900 rounded">(01)03012345678901(10)L-2026-CV-A(17)271231</li>
            <li className="font-mono text-xs p-2 bg-zinc-50 dark:bg-zinc-900 rounded">(01)03012345678901(21)SN-VEU-2026-001</li>
            <li className="font-mono text-xs p-2 bg-zinc-50 dark:bg-zinc-900 rounded">LOC-WH1-A-3-2-7</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
