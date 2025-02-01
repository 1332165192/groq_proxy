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
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm' // 使用 WebM 格式，这是最广泛支持的格式
            });
            this.audioChunks = [];

            this.mediaRecorder.addEventListener('dataavailable', (event) => {
                this.audioChunks.push(event.data);
            });

            this.mediaRecorder.addEventListener('stop', () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.processAudioBlob(audioBlob);
            });

            this.mediaRecorder.start();
            this.startRecordButton.disabled = true;
            this.stopRecordButton.disabled = false;
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showError('Failed to start recording. Please check your microphone permissions.');
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
        const validFormats = ['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'opus', 'wav', 'webm'];
        const fileType = blob.type.split('/')[1];
        
        if (!validFormats.includes(fileType)) {
            this.showError(`Invalid file format. Supported formats: ${validFormats.join(', ')}`);
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