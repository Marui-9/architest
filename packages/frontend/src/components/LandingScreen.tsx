import { useState, useCallback } from 'react';
import { useAppStore } from '../store';

export default function LandingScreen() {
  const [projectPath, setProjectPath] = useState('');
  const { scanning, scanError, scanProject, scanDaemon } = useAppStore();

  const handleScanProject = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (projectPath.trim()) {
        scanProject(projectPath.trim());
      }
    },
    [projectPath, scanProject],
  );

  const handleScanDaemon = useCallback(() => {
    scanDaemon();
  }, [scanDaemon]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-10">
      {/* Logo & tagline */}
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          Archi<span className="text-blue-400">Test</span>
        </h1>
        <p className="mt-3 text-lg text-gray-400">
          See it. Score it. Test it.
        </p>
      </div>

      {/* Scan modes */}
      <div className="w-full max-w-lg flex flex-col gap-6">
        {/* Mode 1: Project path */}
        <form onSubmit={handleScanProject} className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-300" htmlFor="project-path">
            Scan a project directory
          </label>
          <div className="flex gap-2">
            <input
              id="project-path"
              type="text"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="/path/to/your/project"
              className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={scanning}
            />
            <button
              type="submit"
              disabled={scanning || !projectPath.trim()}
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {scanning ? 'Scanning…' : 'Scan'}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-700" />
          <span className="text-sm text-gray-500">or</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        {/* Mode 2: Docker daemon */}
        <button
          onClick={handleScanDaemon}
          disabled={scanning}
          className="w-full px-5 py-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 font-medium hover:bg-gray-750 hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="flex items-center justify-center gap-2">
            <DockerIcon />
            {scanning ? 'Scanning…' : 'Scan running containers'}
          </span>
        </button>

        {/* Error */}
        {scanError && (
          <div className="px-4 py-3 rounded-lg bg-red-900/40 border border-red-800 text-red-300 text-sm">
            {scanError}
          </div>
        )}
      </div>
    </div>
  );
}

function DockerIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.98 11.08h2.12a.19.19 0 0 0 .19-.19V9.01a.19.19 0 0 0-.19-.19h-2.12a.19.19 0 0 0-.19.19v1.88c0 .11.08.19.19.19m-2.95-5.43h2.12a.19.19 0 0 0 .19-.19V3.58a.19.19 0 0 0-.19-.19h-2.12a.19.19 0 0 0-.19.19v1.88c0 .1.09.19.19.19m0 2.71h2.12a.19.19 0 0 0 .19-.19V6.29a.19.19 0 0 0-.19-.19h-2.12a.19.19 0 0 0-.19.19v1.88c0 .11.09.19.19.19m-2.93 0h2.12a.19.19 0 0 0 .19-.19V6.29a.19.19 0 0 0-.19-.19H8.1a.19.19 0 0 0-.19.19v1.88c0 .11.08.19.19.19m-2.96 0h2.12a.19.19 0 0 0 .19-.19V6.29a.19.19 0 0 0-.19-.19H5.14a.19.19 0 0 0-.19.19v1.88c0 .11.09.19.19.19m5.89 2.72h2.12a.19.19 0 0 0 .19-.19V9.01a.19.19 0 0 0-.19-.19h-2.12a.19.19 0 0 0-.19.19v1.88c0 .11.09.19.19.19m-2.93 0h2.12a.19.19 0 0 0 .19-.19V9.01a.19.19 0 0 0-.19-.19H8.1a.19.19 0 0 0-.19.19v1.88c0 .11.08.19.19.19m-2.96 0h2.12a.19.19 0 0 0 .19-.19V9.01a.19.19 0 0 0-.19-.19H5.14a.19.19 0 0 0-.19.19v1.88c0 .11.09.19.19.19m-2.92 0h2.12a.19.19 0 0 0 .19-.19V9.01a.19.19 0 0 0-.19-.19H2.22a.19.19 0 0 0-.19.19v1.88c0 .11.08.19.19.19m20.66 1.09c-.26-.15-.86-.25-1.29-.15-.07-.52-.36-1-.89-1.42l-.3-.21-.22.29c-.28.35-.44.84-.39 1.31.02.18.09.51.3.8-.21.12-.64.29-1.19.28H.88a.45.45 0 0 0-.45.44c-.03.81.06 1.63.27 2.39.24.87.62 1.52 1.15 1.93.6.46 1.57.73 2.69.73.5 0 1.02-.05 1.55-.17a7.5 7.5 0 0 0 2.22-.93 6.7 6.7 0 0 0 1.59-1.47c.73-.96 1.17-2.04 1.46-2.97h.13c.79 0 1.28-.32 1.55-.59.18-.17.32-.38.42-.6l.06-.17z" />
    </svg>
  );
}
