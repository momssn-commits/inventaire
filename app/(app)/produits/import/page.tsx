'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Upload, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const TEMPLATE_CSV = [
  'sku;nom;type;suivi;barcode;cout;salePrice;minQty;notes',
  'PROD-001;Produit exemple;storable;none;;0;0;0;',
].join('\n');

function downloadTemplate() {
  const blob = new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modele_import_produits.csv';
  a.click();
  URL.revokeObjectURL(url);
}

type Row = { sku: string; nom: string; type: string; suivi: string; barcode?: string; cout?: string; salePrice?: string; minQty?: string; notes?: string };
type Result = { ok: number; errors: { row: number; sku: string; error: string }[] };

export default function ImportProductsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string).replace(/^﻿/, '');
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) { setError('Fichier vide ou sans données.'); return; }
      const headers = lines[0].split(';').map((h) => h.trim().toLowerCase());
      const parsed = lines.slice(1).map((line) => {
        const cols = line.split(';');
        const row: any = {};
        headers.forEach((h, i) => { row[h] = cols[i]?.trim() ?? ''; });
        return row as Row;
      });
      setRows(parsed);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/import/produits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/produits" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>
        <div>
          <h1 className="text-xl font-bold">Importer des produits</h1>
          <p className="text-sm" style={{ color: 'rgb(148,155,180)' }}>Import CSV — séparateur point-virgule (;)</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="card p-5 mb-4">
        <h2 className="font-semibold mb-3">Colonnes attendues</h2>
        <div className="overflow-x-auto">
          <table className="table-base text-xs">
            <thead>
              <tr>
                <th>Colonne</th>
                <th>Obligatoire</th>
                <th>Valeurs acceptées</th>
                <th>Exemple</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['sku', 'Oui', 'Texte unique', 'PROD-001'],
                ['nom', 'Oui', 'Texte', 'Câble USB-C'],
                ['type', 'Non', 'storable | consumable | service', 'storable'],
                ['suivi', 'Non', 'none | lot | serial', 'none'],
                ['barcode', 'Non', 'Code-barres unique', '3700123456789'],
                ['cout', 'Non', 'Nombre (FCFA)', '5000'],
                ['salePrice', 'Non', 'Nombre (FCFA)', '7500'],
                ['minQty', 'Non', 'Nombre', '10'],
                ['notes', 'Non', 'Texte libre', ''],
              ].map(([col, req, vals, ex]) => (
                <tr key={col}>
                  <td className="font-mono">{col}</td>
                  <td>{req === 'Oui' ? <span className="text-red-400">Oui</span> : <span className="text-zinc-500">Non</span>}</td>
                  <td className="text-zinc-400">{vals}</td>
                  <td className="text-zinc-400">{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={downloadTemplate} className="btn-secondary mt-3 text-sm">
          <Download className="size-4" /> Télécharger le modèle CSV
        </button>
      </div>

      {/* Upload */}
      <div className="card p-5 mb-4">
        <label className="block mb-2 font-medium">Fichier CSV</label>
        <input
          type="file"
          accept=".csv,.txt"
          onChange={handleFile}
          className="block w-full text-sm text-zinc-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
        />
        {fileName && (
          <p className="mt-2 text-sm" style={{ color: 'rgb(148,155,180)' }}>
            Fichier : <strong>{fileName}</strong> — {rows.length} ligne{rows.length > 1 ? 's' : ''} détectée{rows.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="card overflow-x-auto mb-4">
          <div className="p-3 border-b font-medium text-sm" style={{ borderColor: 'rgb(38,42,62)' }}>
            Aperçu ({rows.length} produits)
          </div>
          <table className="table-base text-xs">
            <thead>
              <tr>
                {Object.keys(rows[0]).map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  {Object.values(r).map((v, j) => <td key={j}>{v || '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <div className="p-2 text-center text-xs" style={{ color: 'rgb(148,155,180)' }}>
              … et {rows.length - 10} autre{rows.length - 10 > 1 ? 's' : ''} ligne{rows.length - 10 > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-lg text-sm text-red-400"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="card p-5 mb-4 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <CheckCircle className="size-5" /> {result.ok} produit{result.ok > 1 ? 's' : ''} importé{result.ok > 1 ? 's' : ''} avec succès
          </div>
          {result.errors.length > 0 && (
            <div>
              <p className="text-sm text-red-400 mb-2">{result.errors.length} erreur{result.errors.length > 1 ? 's' : ''} :</p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-300">Ligne {e.row} ({e.sku}) : {e.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleImport}
          disabled={rows.length === 0 || loading}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Lancer l'import ({rows.length} ligne{rows.length > 1 ? 's' : ''})
        </button>
        {result?.ok ? (
          <Link href="/produits" className="btn-secondary">Voir les produits</Link>
        ) : null}
      </div>
    </div>
  );
}
