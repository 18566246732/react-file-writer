import React, { useEffect, useRef, useState } from 'react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

let frameReadable: ReadableStream<VideoFrame>;
let handle: Worker;
let trackSettings: MediaTrackSettings;
let number = 0;
let isTextWriterClosed = false;
const FILE_QUOTA = 1024 * 1024; // 1MB

const FilePicker = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [startDate, setStartDate] = useState<Date>(null);
    const [endDate, setEndDate] = useState<Date>(null);
    
    const startRecording = async () => {
        const fileHandle = await window.showSaveFilePicker({ 
            suggestedName: 'video.webm',
            types: [{
                description: 'video file',
                accept: { 
                    'video/webm': ['.webm']
                } 
            }]
        });

        // @ts-ignore
        handle.postMessage({
            fileHandle,
            frameReadable,
            trackSettings,
            cmd: 'startRecording'
        }, [frameReadable])  
    }

    const stopRecording = () => {
        handle.postMessage({
            cmd: 'stopRecording'
        });
    }

    const startLogging = async () => {
        handle.postMessage({
            filename: 'mediaSDK',
            ext: '.txt',
            quota: FILE_QUOTA,
            cmd: 'startLogging'
        });
        handle.onmessage = (ev: any) => {
            switch (ev.data.cmd) {
                case 'logWriter1Started':
                    (function sendLogs() {
                        const inteval = setInterval(() => {
                            if (isTextWriterClosed) {
                                clearInterval(inteval);
                                isTextWriterClosed = false;
                                return;
                            }
                            handle.postMessage({
                                cmd: 'logs',
                                text: 'this is a new log of' + number++
                               }) 
                        }, 100)
                     })()
                    break;
                case 'logWriterClosed':
                    isTextWriterClosed = true;
                    break;

                
                default:
                    break;
            }
        }
    }

    const saveLogging = () => {
        handle.postMessage({
            cmd: 'saveLogging'
        });
    };

    const clearFile = () => {
        handle.postMessage({
            cmd: 'clearLog'
        });
    }

    const checkFile = async () => {
        handle.postMessage({
            cmd: 'checkFiles'
        })
    }

    const queryForFileNameUsingRange = async () => {
        const _startDate = +new Date(startDate);
        const _endDate = +new Date(endDate);
        const targetDirHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });

        handle.postMessage({
            cmd: 'queryForFileNameUsingRange',
            targetDirHandle,
            startDate: _startDate,
            endDate: _endDate
        });
    }

    const writeRealTimeLog = async () => {
        const targetFileHandle = await window.showSaveFilePicker({
            suggestedName: 'realtimeLog',
            types: [{
                description: 'real time log',
                accept: { 
                    'text/plain': ['.log']
                }
            }]
        });


        handle.postMessage({
            cmd: 'writeRealTimeLog',
            targetFileHandle
        });
    }

    const stopRealTimeLog = async () => {
        handle.postMessage({
            cmd: 'stopRealTimeLog',
        });
    }

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: { 
            width: 800,
            frameRate: 30
        }, audio: false }).then(stream => {
            videoRef.current!.srcObject = stream
            const videoTrack = stream.getVideoTracks()[0];
            trackSettings = videoTrack.getSettings(); 
            const vtp = new MediaStreamTrackProcessor({
                track: videoTrack
            });
            frameReadable = vtp.readable;
            handle = new Worker('file-worker.js');
        });
    }, [])

    return <div>
        <video ref={videoRef} playsInline autoPlay>
        </video>

        <div>
            <button onClick={startRecording}>
                start recording
            </button>
            <button onClick={stopRecording}>
                stop recording
            </button>
        </div>

        <div>
            <button onClick={startLogging}>start logging</button>
            <button onClick={saveLogging}>save logging</button>
            <button onClick={checkFile}>export logging</button>
            <button onClick={clearFile}>click all entryies</button>
        </div>

        <div>
            <div className='date-picker'>
                <div style={{display: 'flex'}}>start time: <DatePicker selected={startDate} onChange={(date: Date) => setStartDate(date)} /></div>
                <div style={{display: 'flex'}}>end time: <DatePicker selected={endDate} onChange={(date: Date) => setEndDate(date)} /></div>
            </div>
            <button onClick={queryForFileNameUsingRange}>query for file names using range</button>
        </div>
        <div>
            <button onClick={writeRealTimeLog}>real time debugging</button>
            <button onClick={stopRealTimeLog}>stop real time debugging</button>
        </div>
    </div>
};

export default FilePicker;