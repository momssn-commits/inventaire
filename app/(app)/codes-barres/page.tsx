import { ScanLine, Smartphone, Wifi, Usb, Camera, Zap, Info } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { WarehouseModeClient } from '@/components/WarehouseModeClient';

export default function BarcodePage() {
  return (
    <div>
      <PageHeader
        title="Codes-barres"
        subtitle="Interface de scan plein écran optimisée pour les opérations en entrepôt"
        module="M5"
      />

      {/* Modes de scan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-start gap-3">
          <div className="size-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 grid place-items-center text-blue-600 shrink-0 mt-0.5">
            <Camera className="size-4" />
          </div>
          <div>
            <p className="font-medium text-sm">Caméra</p>
            <p className="text-xs text-zinc-500 mt-0.5">BarcodeDetector API — smartphone & tablette</p>
          </div>
        </div>
        <div className="card p-4 flex items-start gap-3">
          <div className="size-9 rounded-lg bg-green-50 dark:bg-green-900/20 grid place-items-center text-green-600 shrink-0 mt-0.5">
            <Usb className="size-4" />
          </div>
          <div>
            <p className="font-medium text-sm">Scanner USB/BT</p>
            <p className="text-xs text-zinc-500 mt-0.5">Saisie directe dans le champ actif</p>
          </div>
        </div>
        <div className="card p-4 flex items-start gap-3">
          <div className="size-9 rounded-lg bg-purple-50 dark:bg-purple-900/20 grid place-items-center text-purple-600 shrink-0 mt-0.5">
            <Wifi className="size-4" />
          </div>
          <div>
            <p className="font-medium text-sm">PWA installée</p>
            <p className="text-xs text-zinc-500 mt-0.5">Fonctionne hors ligne, icône bureau</p>
          </div>
        </div>
      </div>

      {/* Module de scan principal */}
      <WarehouseModeClient />

      {/* Documentation GS1 + tests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="size-4 text-brand-600" />
            <h3 className="font-semibold text-sm">Application Identifiers GS1</h3>
          </div>
          <table className="table-base text-xs">
            <thead>
              <tr>
                <th>AI</th>
                <th>Signification</th>
                <th>Exemple</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold">(01)</td>
                <td>Identifiant produit (GTIN)</td>
                <td className="font-mono text-[10px] text-zinc-500">(01)03012345678900</td>
              </tr>
              <tr>
                <td className="font-mono font-bold">(10)</td>
                <td>Numéro de lot</td>
                <td className="font-mono text-[10px] text-zinc-500">(10)LOT2026-A</td>
              </tr>
              <tr>
                <td className="font-mono font-bold">(17)</td>
                <td>Date de péremption (AAMMJJ)</td>
                <td className="font-mono text-[10px] text-zinc-500">(17)261231</td>
              </tr>
              <tr>
                <td className="font-mono font-bold">(21)</td>
                <td>Numéro de série</td>
                <td className="font-mono text-[10px] text-zinc-500">(21)SN0001</td>
              </tr>
              <tr>
                <td className="font-mono font-bold">(30)</td>
                <td>Quantité variable</td>
                <td className="font-mono text-[10px] text-zinc-500">(30)42</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="size-4 text-zinc-500" />
            <h3 className="font-semibold text-sm">Codes de test</h3>
          </div>
          <p className="text-xs text-zinc-500 mb-3">Collez ou saisissez ces codes dans le champ de scan :</p>
          <div className="space-y-2">
            {[
              '3012345678901',
              '(01)03012345678901(10)L-2026-CV-A(17)271231',
              '(01)03012345678901(21)SN-VEU-2026-001',
              'LOC-WH1-A-3-2-7',
            ].map((code) => (
              <div
                key={code}
                className="font-mono text-[10px] p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 select-all cursor-copy"
              >
                {code}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <Smartphone className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Pour une expérience optimale sur mobile, installez l&apos;application en PWA depuis le menu du navigateur.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
