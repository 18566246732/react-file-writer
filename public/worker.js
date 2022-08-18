self.onmessage = (e) => {
    switch (e.data.cmd) {
        case 'startEmitLogs':
            console.log('message received');
            break;
        default:
            break;
    }
}