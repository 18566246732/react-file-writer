import React, { useRef, useState } from 'react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import FileWriter from 'disk-file-writer';

let number = 0;
let activeWriter = {
    realtimeLogWriter: false,
    normalLogWriter: false
};

const fileWriter = new FileWriter({
    maxDaysToKeepFile: 30,
    fileSizeQuota: 102 * 1024 * 5
});

fileWriter.on('logWriterClosed', () => {
    activeWriter.normalLogWriter = false;
});

fileWriter.on('realtimeLogWriterClosed', () => {
    activeWriter.realtimeLogWriter = false;
});

fileWriter.on('OPFSFilesInfo', (filesInfo) => {
    console.log(filesInfo);
});

const writeLogs = () => {
    console.log(activeWriter.realtimeLogWriter, 'activeWriter.realtimeLogWriter');
    
    if (activeWriter.normalLogWriter || activeWriter.realtimeLogWriter) {
        return;
    }
    const inteval = setInterval(() => {
        
        if (!activeWriter.normalLogWriter && !activeWriter.realtimeLogWriter) {
            clearInterval(inteval);
            return;
        }
        fileWriter.writeLog('this is a new log of' + number++);
    }, 100);
}

fileWriter.on('createLogFileReady', () => {
    console.log('createLogFileReady');
    
    writeLogs();
    activeWriter.normalLogWriter = true;
});

fileWriter.on('createRealTimeLogFileReady', () => {
    console.log('createRealTimeLogFileReady');
    
    writeLogs();
    activeWriter.realtimeLogWriter = true;
})

const FilePicker = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [startDate, setStartDate] = useState<Date>(null);
    const [endDate, setEndDate] = useState<Date>(null);
    
    const startWriteVideoFile = async () => {
        fileWriter.startWriteVideoFile({
            shareScreen: true,
            recordMicrophone: true
        })
    }

    const stopWriteVideoFile = () => {
        fileWriter.stopWriteVideoFile();
    }

    const startLogging = () => {
        fileWriter.createLogFile('medis_SDK', '.txt')
    }

    const saveLogging = () => {
        fileWriter.saveLogFile();
    };

    const clearFile = () => {
        fileWriter.clearOPFSFiles();
    }

    const checkAllFiles = async () => {
        fileWriter.getOPFSFilesInfoByDate();
    }

    const writeRealTimeLog = async () => {
        fileWriter.createRealTimeLogFile({
            fileName: 'realtimeLog', 
            fileExtension: '.txt'
        });
    }

    const stopRealTimeLog = async () => {
        fileWriter.stopWriteRealTimeLog();
    }

    const emitLogFromWorker = () => {
        const worker = new Worker('./worker.js');
        worker.postMessage({
            cmd: 'startEmitLogs'
        })
    }

    return <div>
        <video ref={videoRef} playsInline autoPlay style={{
            maxWidth: '1000px'
        }}>
        </video>

        <div>
            <h3>recording a shared screen</h3>
            <button onClick={startWriteVideoFile}>
                start WriteVideoFile
            </button>
            <button onClick={stopWriteVideoFile}>
                stop WriteVideoFile
            </button>
        </div>

        <div>
            <h3>write normal log with log-rotate</h3>
            <button onClick={startLogging}>start logging</button>
            <button onClick={saveLogging}>save logging</button>
            <button onClick={checkAllFiles}>export logging</button>
            <button onClick={clearFile}>clear all entryies</button>
        </div>

        <div>
            <h3>move files from private disk space into designated folder</h3>
            <div className='date-picker'>
                <div style={{display: 'flex'}}>start time: <DatePicker selected={startDate} onChange={(date: Date) => setStartDate(date)} /></div>
                <div style={{display: 'flex'}}>end time: <DatePicker selected={endDate} onChange={(date: Date) => setEndDate(date)} /></div>
            </div>
            <button onClick={() => fileWriter.getOPFSFilesInfoByDate(+new Date(startDate), +new Date(endDate))}>query for file names using range</button>
            <button onClick={() => fileWriter.moveOPFSFileByDate({
                startDate: +new Date(startDate),
                endDate: +new Date(endDate),
                includeUnfinishedFiles: true 
            })}>move files within Date range</button>
        </div>
        <div>
            <h3>real time debugging</h3>
            <button onClick={writeRealTimeLog}>real time debugging</button>
            <button onClick={stopRealTimeLog}>stop real time debugging</button>
        </div>

        <div>
            <h3>for web worker</h3>
            <button onClick={emitLogFromWorker}>start a worker and emit logs</button>
        </div>
    </div>
};

export default FilePicker;