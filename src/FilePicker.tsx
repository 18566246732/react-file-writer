import React, { useEffect, useRef, useState } from 'react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { workerBuilder } from './WorkerBuilder';
import fileWorker from './file-worker';
import db from './db';
import webmWriter2 from './webm-writer2';

let frameReadable: ReadableStream<VideoFrame>;
let handle: Worker;
let trackSettings: MediaTrackSettings;
let number = 0;
let isTextWriterClosed = false;
let recoderFileWritable: FileSystemWritableFileStream;
let mediaRecorder: MediaRecorder;
const FILE_QUOTA = 1024 * 1024; // 1MB
let stream4Recorder: MediaStream;
let audioStream: MediaStream;
let audioElement: HTMLAudioElement;

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
                case 'startWriting':
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
            cmd: 'clearLogFile'
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

    const startRecorder = async () => {
        const ctx = new AudioContext();

        const audioSourceNode1= ctx.createMediaElementSource(audioElement);
        const audioDestinationNode = ctx.createMediaStreamDestination();
        const audioSourceNode2 = ctx.createMediaStreamSource(audioStream);
        console.log(audioDestinationNode.channelCount, 'audioDestinationNode before');

        audioSourceNode1.connect(audioDestinationNode);
        audioSourceNode2.connect(audioDestinationNode);

        console.log(audioDestinationNode.channelCount, 'audioDestinationNode after');
        

        audioElement.play();


        const recoderFileHandle = await window.showSaveFilePicker({ 
            suggestedName: 'video.mp4',
            types: [{
                description: 'video file',
                accept: { 
                    'video/mp4': ['.mp4']
                }
            }]
        });

        const option = {
            audioBitsPerSecond : 128000,
            videoBitsPerSecond : 2500000,
            mimeType: 'video/mp4; codecs=vp9'
        }

        const allTracks = [...stream4Recorder.getTracks(), ...audioDestinationNode.stream.getAudioTracks()];
        
        const mixedStream = new MediaStream(allTracks);
        mediaRecorder = new MediaRecorder(mixedStream, option);
        recoderFileWritable = await recoderFileHandle.createWritable();
        console.log(mediaRecorder, 'mediaRecorder');
        

        mediaRecorder.ondataavailable = async e => {
            console.log(e.data, 'e.data');
            
            recoderFileWritable.write(e.data);
        }
        const timeSlice = 1000
        mediaRecorder.start(timeSlice);

        mediaRecorder.onstop = async () => {
            console.log('stopped');
            
            await recoderFileWritable.close();
            const file = await recoderFileHandle.getFile();
            console.log(file, 'file');
            
        } 
    }

    const stopRecorder = () => {
        mediaRecorder.stop();
    }

    useEffect(() => {
        handle = workerBuilder(fileWorker, [db, webmWriter2]);
        audioElement = new Audio('https://webrtc.github.io/samples/src/video/chrome.webm');
        audioElement.crossOrigin = "anonymous"

        navigator.mediaDevices.getDisplayMedia({
            video: {
                width: 800,
                frameRate: 30
            },
            audio: true
        }).then(stream => {
            videoRef.current!.srcObject = stream
            stream4Recorder = stream;
        })

        navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 44100,
                echoCancellation: true,
                noiseSuppression: true
            },
            video: false
        }).then(stream => {
            audioStream = stream
        })

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
            <button onClick={startRecorder}>start recorder</button>
            <button onClick={stopRecorder}>save recorder</button>
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