import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Base OG Tags */}
        <meta property="og:site_name" content="ChefMate" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#E66B3D" />

        {/* Fonts preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: `
          body { overflow: auto; overscroll-behavior-y: none; }
          #root { flex: 1; display: flex; }
          @media print {
            .no-print { display: none !important; }
            /* Hide navigation elements when printing */
            [role="tabbar"], [data-testid="tab-bar"] { display: none !important; }
            /* Clean up for print */
            body { background: #fff !important; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
