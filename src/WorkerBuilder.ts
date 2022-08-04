export function workerBuilder(worker: () => void, deps: Array<() => void>) {
    const depsCode = deps.map(dep => `(${dep.toString()})(self);`).join('');
    const rawCode = worker.toString();
    const code = `
        ${depsCode}
        (${rawCode})(self);
    `;
    const blob = new Blob([code], { type: 'text/javascript' });
    const workerURL = window.URL.createObjectURL(blob);
    return new Worker(workerURL);
}