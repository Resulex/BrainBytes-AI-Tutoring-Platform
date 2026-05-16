import Document, { Html, Head, Main, NextScript } from 'next/document';

class BrainBytesDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/* PWA Meta Tags */}
          <meta name="application-name" content="BrainBytes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="BrainBytes" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="theme-color" content="#1a237e" />
          <meta name="description" content="AI-powered tutoring platform for Filipino students" />
          
          {/* PWA Manifest */}
          <link rel="manifest" href="/manifest.json" />
          
          {/* Apple Touch Icons */}
          <link rel="apple-touch-icon" sizes="72x72" href="/icons/icon-72x72.png" />
          <link rel="apple-touch-icon" sizes="96x96" href="/icons/icon-96x96.png" />
          <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144x144.png" />
          <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
          
          {/* Service Worker */}
          <link rel="service-worker" href="/sw.js" />
          
          {/* Fonts */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default BrainBytesDocument;
