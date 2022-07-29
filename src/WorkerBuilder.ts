export function workerBuilder(worker: () => void) {
    const code = worker.toString();
    console.log(code, 'code');
    
    const blob = new Blob([`import WebMWriter from 'webm-writer'; (${code})()`], { type: 'text/javascript' });
    const workerURL = window.URL.createObjectURL(blob);
    console.log('new');
    
    return new Worker(workerURL, { type: 'module' });
}