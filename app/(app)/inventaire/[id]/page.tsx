import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { applyMovement } from '@/lib/stock';
import { formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

async function saveCount(formData: FormData) {
  'use server';
  const session = await requireSession();
  const sheetId = String(formData.get('sheetId') ?? '');
  const sheet = await prisma.countSheet.findUnique({
    where: { id: sheetId },
    include: { lines: true },
  });
  if (!sheet) redirect('/inventaire?error=notfound');

  for (const line of sheet.lines) {
    const qty = Number(formData.get(`qty_${line.id}`) ?? line.qtyCounted);
    const diff = qty - line.qtyTheoretical;
    await prisma.countLine.update({
      where: { id: line.id },
      data: { qtyCounted: qty, qtyDiff: diff },
    });
  }
  redirect(`/inventaire/${sheetId}`);
}

async function validateCount(formData: FormData) {
  'use server';
  const session = await requireSession();
  const sheetId = String(formData.get('sheetId') ?? '');
  const sheet = await prisma.countSheet.findUnique({
    where: { id: sheetId },
    include: { lines: true },
  });
  if (!sheet) redirect('/inventaire?error=notfound');
  if (sheet.state === 'validated') redirect(`/inventaire/${sheetId}`);

  // Emplacement d'inventaire (création/recherche)
  let invLoc = await prisma.location.findFirst({ where: { type: 'inventory' } });
  if (!invLoc) {
    invLoc = await prisma.location.create({
      data: { name: 'Ajustements', fullPath: 'Virtuel/Ajustements', type: 'inventory' },
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const line of sheet.lines) {
      if (Math.abs(line.qtyDiff) < 0.0001) continue;
      const lot = line.lotName
        ? await tx.lot.findFirst({ where: { name: line.lotName, productId: line.productId } })
        : null;

      if (line.qtyDiff > 0) {
        // Excédent : on crée du stock depuis l'inventaire
        await applyMovement(tx, {
          productId: line.productId,
          fromLocationId: invLoc!.id,
          toLocationId: line.locationId,
          qty: line.qtyDiff,
          lotId: lot?.id ?? null,
        });
      } else {
        // Manquant : sortie du stock vers inventaire
        await applyMovement(tx, {
          productId: line.productId,
          fromLocationId: line.locationId,
          toLocationId: invLoc!.id,
          qty: Math.abs(line.qtyDiff),
          lotId: lot?.id ?? null,
        });
      }
    }
    await tx.countSheet.update({
      where: { id: sheetId },
      data: { state: 'validated', validatedAt: new Date() },
    });
  });

  await logAudit({
    action: 'validate',
    entity: 'countSheet',
    entityId: sheetId,
    userId: session.userId,
    companyId: session.companyId,
  });

  redirect(`/inventaire/${sheetId}`);
}

export default async function CountSheetPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const sheet = await prisma.countSheet.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          location: { include: { warehouse: true } },
        },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!sheet) notFound();

  const products = await prisma.product.findMany({
    where: { id: { in: sheet.lines.map((l) => l.productId) } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const totalDiff = sheet.lines.reduce((s, l) => s + Math.abs(l.qtyDiff), 0);
  const linesWithDiff = sheet.lines.filter((l) => Math.abs(l.qtyDiff) > 0.0001).length;

  return (
    <div>
      <PageHeader
        title={`Comptage ${sheet.reference}`}
        subtitle={`Statut : ${sheet.state} • ${sheet.lines.length} lignes`}
        module="M2"
        actions={
          <Link href="/inventaire" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <StatusBadge value={sheet.state} />
        <span className="text-sm text-zinc-500">{linesWithDiff} ligne(s) avec écart, total {formatNumber(totalDiff, 0)} u</span>
      </div>

      <form action={saveCount}>
        <input type="hidden" name="sheetId" value={sheet.id} />
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Emplacement</th>
                <th>Lot</th>
                <th className="text-right">Théorique</th>
                <th className="text-right">Compté</th>
                <th className="text-right">Écart</th>
              </tr>
            </thead>
            <tbody>
              {sheet.lines.map((l) => {
                const p = productMap.get(l.productId);
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="font-mono text-xs">{p?.sku}</div>
                      <div className="text-sm">{p?.name}</div>
                    </td>
                    <td className="text-xs font-mono">{l.location.fullPath}</td>
                    <td className="text-xs font-mono">{l.lotName ?? '—'}</td>
                    <td className="text-right tabular-nums text-zinc-500">{formatNumber(l.qtyTheoretical, 0)}</td>
                    <td className="text-right">
                      {sheet.state === 'validated' ? (
                        <span className="tabular-nums">{formatNumber(l.qtyCounted, 0)}</span>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          name={`qty_${l.id}`}
                          defaultValue={l.qtyCounted}
                          className="input w-24 text-right tabular-nums"
                        />
                      )}
                    </td>
                    <td className={`text-right tabular-nums ${l.qtyDiff > 0 ? 'text-emerald-600' : l.qtyDiff < 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                      {l.qtyDiff > 0 ? '+' : ''}
                      {formatNumber(l.qtyDiff, 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sheet.state !== 'validated' && (
          <div className="flex items-center gap-2 mt-4">
            <button type="submit" className="btn-secondary">Enregistrer les saisies</button>
          </div>
        )}
      </form>

      {sheet.state !== 'validated' && (
        <form action={validateCount} className="mt-3">
          <input type="hidden" name="sheetId" value={sheet.id} />
          <button type="submit" className="btn-primary">
            <Check className="size-4" /> Valider et générer les écritures d'ajustement
          </button>
        </form>
      )}
    </div>
  );
}
