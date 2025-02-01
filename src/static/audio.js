const API_BASE_URL = '/v1';

class AudioProcessor {
    constructor() {
        this.apiKey = localStorage.getItem('groq_api_key');
        if (!this.apiKey) {
            window.location.href = '/login';
            return;
        }
        this.initializeUI();
    }

    initializeUI() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        
        // 获取音频相关元素
        this.startRecordButton = document.getElementById('start-recording');
        this.stopRecordButton = document.getElementById('stop-recording');
        this.uploadButton = document.getElementById('upload-audio');
        this.audioFileInput = document.getElementById('audio-file');
        this.audioLanguageSelect = document.getElementById('audio-language');
        this.audioModeSelect = document.getElementById('audio-mode');
        this.resultsContainer = document.getElementById('results');
        this.errorMessage = document.getElementById('error-message');

        // 绑定事件
        this.startRecordButton.addEventListener('click', () => this.startRecording());
        this.stopRecordButton.addEventListener('click', () => this.stopRecording());
        this.uploadButton.addEventListener('click', () => this.audioFileInput.click());
        this.audioFileInput.addEventListener('change', (e) => this.handleAudioFile(e.target.files[0]));
    }

    async startRecording() {
        try {
            // 检查支持的录音格式
            const mimeTypes = [
                'audio/webm',
                'audio/mp4',
                'audio/ogg',
                'audio/wav'
            ];
            
            // 找到浏览器支持的第一个格式
            const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
            
            if (!supportedType) {
                throw new Error('No supported audio format found. Please try uploading a file instead.');
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: supportedType });
            this.audioChunks = [];

            this.mediaRecorder.addEventListener('dataavailable', (event) => {
                this.audioChunks.push(event.data);
            });

            this.mediaRecorder.addEventListener('stop', () => {
                const audioBlob = new Blob(this.audioChunks, { type: supportedType });
                this.processAudioBlob(audioBlob);
            });

            // 每秒记录一次数据，以确保更好的兼容性
            this.mediaRecorder.start(1000);
            this.startRecordButton.disabled = true;
            this.stopRecordButton.disabled = false;
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showError(error.message || 'Failed to start recording. Please check your microphone permissions.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.startRecordButton.disabled = false;
            this.stopRecordButton.disabled = true;
        }
    }

    async handleAudioFile(file) {
        if (file) {
            await this.processAudioBlob(file);
        }
    }

    async processAudioBlob(blob) {
        // 验证文件格式
        const validFormats = {
            'audio/flac': 'flac',
            'audio/mp3': 'mp3',
            'audio/mp4': 'mp4',
            'audio/mpeg': 'mpeg',
            'audio/mpga': 'mpga',
            'audio/m4a': 'm4a',
            'audio/ogg': 'ogg',
            'audio/opus': 'opus',
            'audio/wav': 'wav',
            'audio/webm': 'webm'
        };
        
        if (!validFormats[blob.type]) {
            this.showError(`Invalid file format. Supported formats: ${Object.values(validFormats).join(', ')}`);
            return;
        }
        
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('model', 'whisper-large-v3');
        
        const language = this.audioLanguageSelect.value;
        if (language) {
            formData.append('language', language);
        }

        const isTranslate = this.audioModeSelect.value === 'translate';
        const endpoint = isTranslate ? '/v1/audio/translations' : '/v1/audio/transcriptions';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new Error(error.error?.message || `Audio processing failed: ${response.statusText}`);
            }

            const result = await response.json();
            this.addResultToUI(isTranslate ? 'Translation' : 'Transcription', result.text);
        } catch (error) {
            console.error('Error processing audio:', error);
            this.showError(`Failed to process audio: ${error.message}`);
        }
    }

    addResultToUI(type, text) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'result-item';
        resultDiv.innerHTML = `
            <div class="result-type">${type}</div>
            <div class="result-text">${text}</div>
        `;
        this.resultsContainer.insertBefore(resultDiv, this.resultsContainer.firstChild);
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        setTimeout(() => {
            this.errorMessage.style.display = 'none';
        }, 5000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.audioProcessor = new AudioProcessor();
}); 