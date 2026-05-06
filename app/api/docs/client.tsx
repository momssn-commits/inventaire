'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    SwaggerUIBundle?: any;
    ui?: any;
  }
}

export function ApiDocsClient() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Charger CSS
    const cssId = 'swagger-ui-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css';
      document.head.appendChild(link);
    }

    // Charger JS
    const scriptId = 'swagger-ui-script';
    if (document.getElementById(scriptId)) {
      mountUI();
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js';
    script.onload = () => mountUI();
    document.body.appendChild(script);

    function mountUI() {
      if (window.SwaggerUIBundle && document.getElementById('swagger-ui')) {
        window.ui = window.SwaggerUIBundle({
          url: '/api/v1/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [window.SwaggerUIBundle.presets.apis],
          layout: 'BaseLayout',
          persistAuthorization: true,
          tryItOutEnabled: true,
          filter: true,
        });
      }
    }
  }, []);

  return (
    <div className="bg-white">
      <div className="bg-brand-600 text-white px-6 py-4">
        <h1 className="text-xl font-semibold">Inventaire — Documentation API v1</h1>
        <p className="text-sm text-brand-100 mt-1">
          Spécification OpenAPI 3 — Conforme au cahier des charges CDC-INVENTAIRE-V1.0
        </p>
      </div>
      <div id="swagger-ui" />
      <style jsx global>{`
        .topbar { display: none !important; }
      `}</style>
    </div>
  );
}
