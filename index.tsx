
import React, { ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Error Boundary Component ---
interface ErrorBoundaryProps {
  // Made optional to satisfy strict attribute checks on usage <ErrorBoundary>...</ErrorBoundary>
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Fix: Use React.Component explicitly and property initialization for state and props to resolve TS errors
// where 'state' and 'props' were reported as missing from ErrorBoundary.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Explicitly declare state and props to resolve inference issues in this environment.
  public state: ErrorBoundaryState = {
    hasError: false,
    error: undefined,
  };

  // Fix for: Property 'props' does not exist on type 'ErrorBoundary'
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    // Explicitly initialize props on the instance to ensure visibility to the TS compiler
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  render(): ReactNode {
    // Accessing state which is now correctly declared on the class.
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center font-sans p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center max-w-lg">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Oops! Qualcosa è andato storto.</h1>
            <p className="text-gray-300 mb-6">
              Si è verificato un errore inaspettato. Prova a ricaricare la pagina. Se il problema persiste, contatta il supporto.
            </p>
            <pre className="bg-gray-700/50 p-4 rounded-md text-left text-sm text-red-300 overflow-auto mb-6" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {this.state.error?.toString()}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Ricarica Pagina
            </button>
          </div>
        </div>
      );
    }

    // Accessing props which is now correctly declared on the class.
    return this.props.children;
  }
}
// --- End Error Boundary Component ---

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// --- PWA Service Worker Registration ---
// Disattivato nel preview environment di AI Studio per problemi di compatibilità con gli iframe
const isAIStudioPreview = window.location.hostname.includes('europe-west2.run.app') || window.location.hostname.includes('aistudio.google.com');

if ('serviceWorker' in navigator && !isAIStudioPreview) {
  window.addEventListener('load', () => {
    // Use relative path with explicit scope to handle preview environments better
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then((registration) => {
        console.log('ServiceWorker registration successful');
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
} else if (isAIStudioPreview) {
  console.log('ServiceWorker disattivato in modalità Preview AI Studio.');
}
