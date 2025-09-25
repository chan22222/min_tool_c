/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from "@google/genai";
import type { Part } from "@google/genai";
import { Document, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";

// API Key Pools
const GEMINI_API_KEYS = [
    "AIzaSyA-kO8AhYxetU22pqe2rnf1bel3parm95k",
    "AIzaSyBnZa7HuxuRHglzwfSZM5_7U-_xDnOOmKI",
    "AIzaSyAhFR3YmZ9ikc4NyEIUptBc8v5E8A1ro6I",
    "AIzaSyDEsceKXp2vHmY-SAPc8ljwDwrOJnyw_kk",
    "AIzaSyBFnoLIMGOd3ebJ0gMeQmMjYR6Kckz-eOY",
    "AIzaSyCGVTaJDSuUkxiyTteUULwXYCCwGuo4KEo",
    "AIzaSyCFB71jlhqN-fpQFZ6llM_pBhRRrPklwwA",
    "AIzaSyBWt8lJ-XdDpzLbdSQ5xXmNrdMsJ9JeU10",
    "AIzaSyAWpl6wCynGQe2bOXuD_6tqIU01L7E7szM",
    "AIzaSyCUsPLR1iApbsc4Zu6C-N4WUHa87-SYGRA",
    "AIzaSyAo073apw1L2duCGsfyy_zWGZCWvWnuJtk",
    "AIzaSyCg95zbbg6NeNURMfkhC3DIkv2X58KZ2oU",
    "AIzaSyACfrJf7f01TcOIzuNcTFzPzriQ-2jWogo",
    "AIzaSyAlsuXdDBf4A0UJVP6L2tpnDsVmNdKUGxc",
    "AIzaSyAU3kj-2ocaSBkeysCpwrAO2DT_Y-_uF3U",
    "AIzaSyBMVH9fxv6ROBYriKZw6n9rfS6_sw8utSs",
    "AIzaSyD37rMS6_aZZoNDhNvfcmH-peWj9yUTXrA",
    "AIzaSyCdexwLD1kLwVtrS2QHpZwaxWMey23c6Ew",
    "AIzaSyBQikWhQeFLk0UaskgGK-NXQB42hqEUAWA",
    "AIzaSyCKy7to7VClP9NYiualSzeujFFyS1EXGow",
    "AIzaSyDlzgLETjmdhrqLqDroWrLKVEy3phdA_8s",
    "AIzaSyD6vj0p_gNFq-6xDckdCoMUYKp9vZ2l7xk",
    "AIzaSyAhP93Z0Sbzu0wePsNiZ3pFi9HVSzf1hRk",
    "AIzaSyC2uIWwbKTy4uCA6uXXqbCX00_QfnVzGlY",
    "AIzaSyBzHO_JQsU2RR2OA3weQrIKy8Ax_BgRmnY",
    "AIzaSyDGCsEO5x8KdOqekwoEJfipgmtwWA79MiI",
    "AIzaSyDayvMoix4qS6Kllrt6-KhVZWFFx60VPsU",
    "AIzaSyDqSEw0cKRsswlvs3cfRgCYAkBMqKFkwrw",
    "AIzaSyA2vygAHUhEFpbGR5iY0BwXnOHIqJoabuk",
    "AIzaSyDkYm2LUrV_1vC6CwjqtSVBq7VVb2VLD18"
];

const PEXELS_API_KEYS = [
    "ESHeW8oXMAHvJ2VPsal9SH5HjsxDLofnztqXxfol6A0H0Xb00xV6yIeI",
    "rs13Y8ZZ0U3CO5vNOiczBF8zXEpvVQD1cFPVhPgK5qYL0u3yhBO5RcCE",
    "9Z1FksmuJUFqj3uPO5c63fUcu4P0v2zhUhWVIkA3vjREsWQNNeIpPiDn",
    "bwpNEZPE7I6aTvc8tPkdpcMebpG3dYx2iYE536GqBGCvhC4TbuufXFZP"
];

// API Key management
class ApiKeyManager {
    private geminiIndex = 0;
    private pexelsIndex = 0;
    private geminiUsageCount: Map<string, number> = new Map();
    private pexelsUsageCount: Map<string, number> = new Map();
    private failedGeminiKeys: Set<string> = new Set();
    private failedPexelsKeys: Set<string> = new Set();

    getNextGeminiKey(): string {
        // Find an unused key or the least used one
        const availableKeys = GEMINI_API_KEYS.filter(key => !this.failedGeminiKeys.has(key));
        
        if (availableKeys.length === 0) {
            // All keys failed, reset and try again
            console.warn('All Gemini API keys have failed, resetting...');
            this.failedGeminiKeys.clear();
            this.geminiUsageCount.clear();
            return GEMINI_API_KEYS[0];
        }

        // Sort by usage count to use least used key
        availableKeys.sort((a, b) => {
            const countA = this.geminiUsageCount.get(a) || 0;
            const countB = this.geminiUsageCount.get(b) || 0;
            return countA - countB;
        });

        const key = availableKeys[0];
        this.geminiUsageCount.set(key, (this.geminiUsageCount.get(key) || 0) + 1);
        
        console.log(`Using Gemini API key (${availableKeys.length} available, usage: ${this.geminiUsageCount.get(key)})`);
        return key;
    }

    getNextPexelsKey(): string {
        const availableKeys = PEXELS_API_KEYS.filter(key => !this.failedPexelsKeys.has(key));
        
        if (availableKeys.length === 0) {
            this.failedPexelsKeys.clear();
            this.pexelsUsageCount.clear();
            return PEXELS_API_KEYS[0];
        }

        availableKeys.sort((a, b) => {
            const countA = this.pexelsUsageCount.get(a) || 0;
            const countB = this.pexelsUsageCount.get(b) || 0;
            return countA - countB;
        });

        const key = availableKeys[0];
        this.pexelsUsageCount.set(key, (this.pexelsUsageCount.get(key) || 0) + 1);
        return key;
    }

    markGeminiKeyFailed(key: string) {
        this.failedGeminiKeys.add(key);
    }

    markPexelsKeyFailed(key: string) {
        this.failedPexelsKeys.add(key);
    }

    resetGeminiKeys() {
        this.failedGeminiKeys.clear();
        this.geminiUsageCount.clear();
    }

    resetPexelsKeys() {
        this.failedPexelsKeys.clear();
        this.pexelsUsageCount.clear();
    }
}

const apiKeyManager = new ApiKeyManager();

// --- Create Loading Indicator with Logs ---
function createLoadingIndicator(): HTMLDivElement {
    // 기존 로딩 인디케이터가 있으면 제거
    const existing = document.getElementById('loading');
    if (existing) {
        existing.remove();
    }
    
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading';
    loadingDiv.className = 'hidden';
    loadingDiv.style.cssText = `
        margin-top: 20px;
        padding: 15px;
        background: #f9fafb;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
    `;
    loadingDiv.innerHTML = `
        <div class="loading-content" style="background: transparent; padding: 0; box-shadow: none;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <svg class="loading-spinner" width="30" height="30" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" style="animation: spin 1s linear infinite;">
                        <circle cx="25" cy="25" r="20" stroke="#00C73C" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="31.415, 31.415" transform="rotate(-90 25 25)" />
                    </svg>
                    <p style="margin: 0; color: #333; font-size: 16px;">AI가 원고를 작성하고 있습니다... 잠시만 기다려주세요.</p>
                </div>
                <button id="toggle-logs" style="
                    padding: 6px 12px;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    color: #6b7280;
                    transition: all 0.2s;
                " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='white'">
                    <span id="toggle-icon">▼</span> 로그 숨기기
                </button>
            </div>
            <div id="generation-logs" class="generation-logs" style="display: block;"></div>
        </div>
    `;
    
    // CSS 애니메이션 추가 (인라인으로)
    if (!document.querySelector('#spinner-animation-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-animation-style';
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 다중 생성 버튼 아래에 추가
    const multipleBtn = document.getElementById('generate-multiple-button');
    if (multipleBtn && multipleBtn.parentNode) {
        multipleBtn.parentNode.insertBefore(loadingDiv, multipleBtn.nextSibling);
    } else {
        document.body.appendChild(loadingDiv);
    }
    
    // 토글 버튼 이벤트 추가
    const toggleBtn = loadingDiv.querySelector('#toggle-logs') as HTMLButtonElement;
    const logsContainer = loadingDiv.querySelector('#generation-logs') as HTMLDivElement;
    const toggleIcon = loadingDiv.querySelector('#toggle-icon') as HTMLSpanElement;
    
    if (toggleBtn && logsContainer && toggleIcon) {
        toggleBtn.addEventListener('click', () => {
            if (logsContainer.style.display === 'none') {
                logsContainer.style.display = 'block';
                toggleIcon.textContent = '▼';
                toggleBtn.innerHTML = '<span id="toggle-icon">▼</span> 로그 숨기기';
            } else {
                logsContainer.style.display = 'none';
                toggleIcon.textContent = '▶';
                toggleBtn.innerHTML = '<span id="toggle-icon">▶</span> 로그 보기';
            }
        });
    }
    
    return loadingDiv;
}

// --- Add Log to UI ---
function addGenerationLog(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    // 로딩 인디케이터가 없으면 생성
    if (!document.getElementById('loading')) {
        createLoadingIndicator();
    }
    
    const logsContainer = document.getElementById('generation-logs');
    if (!logsContainer) {
        console.log('Logs container not found, creating...');
        // 다시 시도
        setTimeout(() => {
            const retryContainer = document.getElementById('generation-logs');
            if (retryContainer) {
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry log-${type}`;
                logEntry.textContent = message;
                
                // 로그 제한 없이 모두 보관 (스크롤로 확인 가능)
                // if (retryContainer.children.length >= 10) {
                //     retryContainer.removeChild(retryContainer.firstChild!);
                // }
                
                retryContainer.appendChild(logEntry);
                retryContainer.scrollTop = retryContainer.scrollHeight;
            }
        }, 100);
        return;
    }
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.textContent = message;
    
    // 로그 제한 없이 모두 보관 (스크롤로 확인 가능)
    // if (logsContainer.children.length >= 10) {
    //     logsContainer.removeChild(logsContainer.firstChild!);
    // }
    
    logsContainer.appendChild(logEntry);
    
    // 스크롤을 아래로
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

// --- Clear Logs ---
function clearGenerationLogs() {
    const logsContainer = document.getElementById('generation-logs');
    if (logsContainer) {
        // 로그를 삭제하지 않고 접기만 함
        logsContainer.style.display = 'none';
        const toggleBtn = document.querySelector('#toggle-logs') as HTMLButtonElement;
        if (toggleBtn) {
            toggleBtn.innerHTML = '<span id="toggle-icon">▶</span> 로그 보기';
        }
    }
}

// --- DOM Element References ---
const form = document.getElementById('prompt-form') as HTMLFormElement;
const keywordInput = document.getElementById('keyword') as HTMLInputElement;
const popularTopicInput = document.getElementById('popular-topic') as HTMLInputElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const resultContainer = document.getElementById('result') as HTMLDivElement;
const loadingIndicator = document.getElementById('loading') as HTMLDivElement || createLoadingIndicator();
const charCountElement = document.getElementById('char-count') as HTMLSpanElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;
const exportButton = document.getElementById('export-button') as HTMLButtonElement;
const regenerateButton = document.getElementById('regenerate-button') as HTMLButtonElement;
const imageGallery = document.getElementById('image-gallery') as HTMLDivElement;
const refreshImagesButton = document.getElementById('refresh-images') as HTMLButtonElement;
const downloadAllButton = document.getElementById('download-all') as HTMLButtonElement;
const customImagePromptInput = document.getElementById('custom-image-prompt') as HTMLInputElement;
const customPromptSearchButton = document.getElementById('custom-prompt-search') as HTMLButtonElement;

// 키워드 정보 위젯 요소
const keywordInfoWidget = document.getElementById('keyword-info-widget') as HTMLDivElement;
const currentKeywordElement = document.getElementById('current-keyword') as HTMLSpanElement;
const currentTopicElement = document.getElementById('current-topic') as HTMLSpanElement;
const currentStatusElement = document.getElementById('current-status') as HTMLSpanElement;

// Tab and Multiple Generation Elements - 전역 변수로 선언
let tabButtons: NodeListOf<HTMLButtonElement>;
let tabContents: NodeListOf<HTMLDivElement>;
let excelFileInput: HTMLInputElement;
let excelUploadBtn: HTMLButtonElement;
let fileNameDisplay: HTMLElement;
let downloadTemplateBtn: HTMLButtonElement;
let generateMultipleBtn: HTMLButtonElement;
let keywordNavigation: HTMLDivElement;
let keywordButtonsContainer: HTMLDivElement;

// 동시 생성 개수 관련 요소
let concurrentCountInput: HTMLInputElement;
let userConcurrentLimit: number = 10; // 사용자가 설정한 동시 생성 개수 (기본값 10)

// AI 모델 관련
let aiModelSelect: HTMLSelectElement;
let selectedModel: string = 'gemini-2.5-flash'; // 기본 모델을 2.5로 변경



// --- Global Variables ---
let currentImages: any[] = [];
let imageRefreshCount = 0;
let generationRetryCount = 0; // 재생성 시도 횟수 카운트
let multipleContentData: Array<{
    keyword: string, 
    topic: string, 
    content?: string, 
    images?: any[],
    customImagePrompt?: string,  // 각 키워드별 커스텀 프롬프트 저장
    retryCount?: number  // 각 키워드별 재시도 횟수
}> = [];
let currentKeywordIndex = 0;
let currentPageCustomPrompt: string = '';  // 현재 페이지의 커스텀 프롬프트

// --- Gemini API Initialization ---
const modelConfigs = {
    'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        speed: '빠름',
        quality: '안정적',
        description: '가장 안정적인 Gemini 2.5 Flash 모델입니다. 대량 생성에 적합합니다.',
        speedBadgeColor: '#10b981',
        qualityBadgeColor: '#10b981',
        quotaPerMinute: 100  // 분당 할당량
    },
    'gemini-2.0-flash-exp': {
        name: 'Gemini 2.0 Flash',
        speed: '매우빠름',
        quality: '실험적',
        description: 'Gemini 2.0 실험적 모델. 할당량이 적어(분당 10개) 소량 생성에 적합합니다.',
        speedBadgeColor: '#22c55e',
        qualityBadgeColor: '#f59e0b',
        quotaPerMinute: 10  // 분당 10개만 가능!
    },
    'gemini-1.5-flash': {
        name: 'Gemini 1.5 Flash',
        speed: '보통',
        quality: '검증됨',
        description: 'Gemini 1.5 Flash 모델. 안정적이고 검증된 성능을 제공합니다.',
        speedBadgeColor: '#3b82f6',
        qualityBadgeColor: '#10b981',
        quotaPerMinute: 60
    },
    'gemini-1.5-pro': {
        name: 'Gemini 1.5 Pro',
        speed: '느림',
        quality: '최고품질',
        description: 'Gemini 1.5 Pro 모델. 최고 품질의 콘텐츠를 생성합니다.',
        speedBadgeColor: '#ef4444',
        qualityBadgeColor: '#22c55e',
        quotaPerMinute: 30
    }
};

// --- Helper Functions ---
/**
 * Counts Korean characters in a string, excluding whitespace.
 */
function countKoreanChars(text: string): number {
    const cleanText = text.replace(/\s/g, '');
    return cleanText.length;
}

/**
 * Updates the character count display.
 */
function updateCharCount() {
    const text = resultContainer.innerText || '';
    const count = countKoreanChars(text);
    
    // 현재 활성 탭 확인
    const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
    
    // 키워드와 인기주제 가져오기 (탭에 따라 다르게)
    let keyword = '';
    let popularTopic = '';
    
    if (activeTab === 'multiple' && multipleContentData[currentKeywordIndex]) {
        // 다중 생성 모드에서는 현재 선택된 키워드의 데이터 사용
        keyword = multipleContentData[currentKeywordIndex].keyword;
        popularTopic = multipleContentData[currentKeywordIndex].topic;
    } else {
        // 단일 생성 모드에서는 입력 필드 사용
        keyword = keywordInput.value.trim();
        popularTopic = popularTopicInput.value.trim();
    }
    
    let keywordCount = 0;
    let topicCount = 0;
    let topicOrderViolation = false; // 인기주제 단어 순서 위반 체크
    
    if (keyword && text) {
        // 특수문자 이스케이프 처리
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const keywordRegex = new RegExp(escapedKeyword, 'gi');
        const keywordMatches = text.match(keywordRegex);
        keywordCount = keywordMatches ? keywordMatches.length : 0;
    }
    
    if (popularTopic && text) {
        // 특수문자 이스케이프 처리
        const escapedTopic = popularTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const topicRegex = new RegExp(escapedTopic, 'gi');
        const topicMatches = text.match(topicRegex);
        topicCount = topicMatches ? topicMatches.length : 0;
        
        // 인기주제 단어 순서 체크 (공백으로 분리된 경우)
        const topicWords = popularTopic.split(' ').filter(w => w.length > 0);
        if (topicWords.length > 1) {
            // 단어 사이에 다른 내용이 있는지 체크
            const orderedPattern = topicWords.map(word => 
                word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            ).join('\\s+'); // 단어 사이에 공백만 허용
            
            const brokenPattern = topicWords.map(word => 
                word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            ).join('.+'); // 단어 사이에 다른 내용 있음
            
            const orderedRegex = new RegExp(orderedPattern, 'gi');
            const brokenRegex = new RegExp(brokenPattern, 'gi');
            
            const orderedMatches = text.match(orderedRegex) || [];
            const brokenMatches = text.match(brokenRegex) || [];
            
            // 순서가 깨진 경우가 있는지 확인
            if (brokenMatches.length > orderedMatches.length) {
                topicOrderViolation = true;
            }
        }
    }
    
    // 글자수와 키워드 횟수 표시
    let displayText = `글자수(공백제외): ${count} | 키워드: ${keywordCount}회`;
    if (popularTopic && popularTopic !== keyword) {
        displayText += ` | 인기주제: ${topicCount}회`;
        if (topicOrderViolation) {
            displayText += ' ⚠️순서위반';
        }
    }
    
    charCountElement.textContent = displayText;
    
    // 색상 설정
    if (count < 1700 || count > 2600) {
        charCountElement.style.color = '#ff6b6b'; // 빨간색
    } else if ((keyword && keywordCount < 10 && count > 0) || 
               (popularTopic && topicCount < 5 && count > 0) ||
               topicOrderViolation) {
        charCountElement.style.color = '#ff9f43'; // 주황색 (키워드 부족 또는 순서 위반)
    } else if (count >= 1700 && count <= 2600) {
        charCountElement.style.color = '#51cf66'; // 초록색
    }
    
    const hasContent = text.length > 0;
    copyButton.disabled = !hasContent;
    exportButton.disabled = !hasContent;
}

/**
 * Updates the keyword info widget
 */
function updateKeywordInfoWidget(keyword: string = '', topic: string = '', status: 'idle' | 'generating' | 'complete' | 'error' = 'idle', retryCount: number = 0) {
    if (!keywordInfoWidget) return;
    
    // 위젯 표시
    if (keyword || topic) {
        keywordInfoWidget.classList.remove('hidden');
    } else {
        keywordInfoWidget.classList.add('hidden');
        return;
    }
    
    // 키워드와 인기주제 업데이트
    currentKeywordElement.textContent = keyword || '선택 없음';
    currentTopicElement.textContent = topic || '선택 없음';
    
    // 상태 업데이트 (재시도 횟수 포함)
    currentStatusElement.className = 'info-value';
    let statusText = '';
    
    switch (status) {
        case 'generating':
            statusText = retryCount > 0 ? 
                `생성 중... (재시도 ${retryCount}회)` : 
                '생성 중...';
            currentStatusElement.textContent = statusText;
            currentStatusElement.classList.add('status-generating');
            break;
        case 'complete':
            statusText = retryCount > 0 ? 
                `완료 (재시도 ${retryCount}회)` : 
                '완료';
            currentStatusElement.textContent = statusText;
            currentStatusElement.classList.add('status-complete');
            break;
        case 'error':
            statusText = retryCount > 0 ? 
                `오류 (재시도 ${retryCount}회)` : 
                '오류';
            currentStatusElement.textContent = statusText;
            currentStatusElement.classList.add('status-error');
            break;
        default:
            currentStatusElement.textContent = '대기중';
            currentStatusElement.classList.add('status-idle');
    }
}

/**
 * Updates widget based on current tab and content
 */
function updateWidgetFromCurrentTab() {
    const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
    
    if (activeTab === 'single') {
        // 단일 생성 탭에서는 현재 입력된 값 표시
        const keyword = keywordInput.value.trim();
        const topic = popularTopicInput.value.trim();
        const hasContent = resultContainer.innerText.trim().length > 0;
        
        if (keyword || topic || hasContent) {
            updateKeywordInfoWidget(keyword, topic, hasContent ? 'complete' : 'idle');
        } else {
            hideKeywordInfoWidget();
        }
    } else if (activeTab === 'multiple') {
        // 다중 생성 탭에서는 선택된 키워드 표시
        const activeKeywordBtn = document.querySelector('.keyword-btn.active');
        if (activeKeywordBtn && multipleContentData.length > 0) {
            const index = Array.from(keywordButtonsContainer.children).indexOf(activeKeywordBtn);
            if (index >= 0 && multipleContentData[index]) {
                const item = multipleContentData[index];
                const status = item.content ? 'complete' : 'idle';
                updateKeywordInfoWidget(item.keyword, item.topic, status);
            }
        } else {
            hideKeywordInfoWidget();
        }
    } else {
        hideKeywordInfoWidget();
    }
}

/**
 * Hides the keyword info widget
 */
function hideKeywordInfoWidget() {
    if (keywordInfoWidget) {
        keywordInfoWidget.classList.add('hidden');
    }
}
/**
 * Searches for images on Pexels based on query with API key rotation
 */
async function searchPexelsImages(query: string, perPage: number = 15, page: number = 1): Promise<any[]> {
    let lastError: any;
    let attempts = 0;
    const maxAttempts = PEXELS_API_KEYS.length;
    
    while (attempts < maxAttempts) {
        const apiKey = apiKeyManager.getNextPexelsKey();
        
        try {
            // 영어로 번역된 쿼리 사용
            const searchQuery = query.trim();
            
            const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}&orientation=landscape`, {
                headers: {
                    'Authorization': apiKey
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.photos && data.photos.length > 0) {
                    return data.photos;
                }
            } else if (response.status === 429 || response.status === 403) {
                // Rate limit or auth issue, mark key as failed
                apiKeyManager.markPexelsKeyFailed(apiKey);
                throw new Error(`Pexels API error: ${response.status}`);
            }
            
            return [];
        } catch (error) {
            console.error(`Error with Pexels API key ${attempts + 1}:`, error);
            lastError = error;
            attempts++;
        }
    }
    
    console.error('All Pexels API keys failed:', lastError);
    return [];
}

/**
 * Extract core keyword and translate for better search
 */
function extractAndTranslateKeyword(text: string): { core: string, translated: string } {
    // 일반적인 접미사들 제거
    const suffixes = [
        '분양가격', '분양가', '분양', '가격', '비용', '훈련법', '훈련', '방법', 
        '키우기', '관리법', '관리', '특징', '성격', '종류', '추천', '순위',
        '먹이', '사료', '간식', '용품', '병원', '미용', '산책', '놀이',
        '입양', '가정분양', '무료분양', '책임비', '예방접종', '중성화',
        '수명', '크기', '털빠짐', '짖음', '공격성', '지능', '운동량', '품종'
    ];
    
    let core = text;
    let suffix = '';
    
    // 접미사 분리 및 저장
    for (const s of suffixes) {
        if (core.endsWith(s)) {
            suffix = s;
            core = core.slice(0, -s.length);
            break;
        }
    }
    
    // 핵심 단어 영어 번역
    const coreTranslations: { [key: string]: string } = {
        '강아지': 'dog puppy',
        '고양이': 'cat kitten',
        // 강아지 품종
    '말티즈': 'maltese',
    '말티': 'maltese dog',
    '푸들': 'poodle',
    '토이푸들': 'toy poodle',
    '포메': 'pomeranian',
    '포메라니안': 'pomeranian',
    '비숑': 'bichon frise',
    '비숑프리제': 'bichon frise',
    '시바견': 'shiba inu',
    '시바이누': 'shiba inu',
    '시츄': 'shih tzu',
    '요크셔': 'yorkshire terrier',
    '요키': 'yorkie',
    '치와와': 'chihuahua',
    '웰시코기': 'welsh corgi',
    '코기': 'corgi',
    '닥스훈트': 'dachshund',
    '골든리트리버': 'golden retriever',
    '골든': 'golden retriever',
    '래브라도': 'labrador retriever',
    '라브라도': 'labrador',
    '허스키': 'siberian husky',
    '시베리안허스키': 'siberian husky',
    '진돗개': 'jindo dog',
    '진도견': 'jindo',
    '비글': 'beagle',
    '불독': 'bulldog',
    '프렌치불독': 'french bulldog',
    '잉글리시불독': 'english bulldog',
    '보더콜리': 'border collie',
    '사모예드': 'samoyed',
    '도베르만': 'doberman',
    '로트와일러': 'rottweiler',
    '그레이하운드': 'greyhound',
    '달마시안': 'dalmatian',
    '파피용': 'papillon',
    '차우차우': 'chow chow',
    '슈나우저': 'schnauzer',
    '코카스파니엘': 'cocker spaniel',
    '저먼셰퍼드': 'german shepherd',
    '셰퍼드': 'shepherd dog',
    
    // 추가 품종들
    '스탠다드푸들': 'standard poodle',
    '미니어처푸들': 'miniature poodle',
    '미니푸들': 'mini poodle',
    '말티푸': 'maltipoo',
    '폼피츠': 'pom-pitz',
    '폼스키': 'pomsky',
    '페키니즈': 'pekingese',
    '페키니즈개': 'pekingese dog',
    '퍼그': 'pug',
    '닥스': 'dachshund dog',
    '미니핀': 'miniature pinscher',
    '미니어처핀셔': 'min pin',
    '잭러셀테리어': 'jack russell terrier',
    '잭러셀': 'jack russell',
    '불테리어': 'bull terrier',
    '스태피': 'staffordshire terrier',
    '아메리칸불리': 'american bully',
    '핏불': 'pitbull',
    '핏불테리어': 'pitbull terrier',
    '아키타': 'akita',
    '아키타견': 'akita inu',
    '셰틀랜드쉽독': 'shetland sheepdog',
    '셔틀랜드': 'sheltie',
    '콜리': 'collie',
    '러프콜리': 'rough collie',
    '올드잉글리시쉽독': 'old english sheepdog',
    '뉴펀들랜드': 'newfoundland',
    '세인트버나드': 'saint bernard',
    '버니즈마운틴독': 'bernese mountain dog',
    '버니즈': 'bernese',
    '그레이트피레니즈': 'great pyrenees',
    '피레니즈': 'pyrenees dog',
    '알래스칸말라뮤트': 'alaskan malamute',
    '말라뮤트': 'malamute',
    '차우': 'chow dog',
    '샤페이': 'shar pei',
    '바센지': 'basenji',
    '휘핏': 'whippet',
    '이탈리안그레이하운드': 'italian greyhound',
    '브리타니': 'brittany spaniel',
    '잉글리시코카스파니엘': 'english cocker spaniel',
    '아메리칸코카스파니엘': 'american cocker spaniel',
    '스프링거스파니엘': 'springer spaniel',
    '킹찰스스파니엘': 'king charles spaniel',
    '카발리에킹찰스': 'cavalier king charles',
    '웨스트하이랜드테리어': 'west highland terrier',
    '웨스티': 'westie',
    '스코티시테리어': 'scottish terrier',
    '스코티': 'scottie',
    '케언테리어': 'cairn terrier',
    '오스트레일리안셰퍼드': 'australian shepherd',
    '오스트레일리안캐틀독': 'australian cattle dog',
    '블루힐러': 'blue heeler',
    '레드힐러': 'red heeler',
    '벨지안말리노이즈': 'belgian malinois',
    '말리노이즈': 'malinois',
    '벨지안셰퍼드': 'belgian shepherd',
    '터뷰런': 'tervuren',
    '그로넨달': 'groenendael',
    '레온베르거': 'leonberger',
    '티베탄마스티프': 'tibetan mastiff',
    '잉글리시마스티프': 'english mastiff',
    '불마스티프': 'bullmastiff',
    '나폴리탄마스티프': 'neapolitan mastiff',
    '복서': 'boxer',
    '복서독': 'boxer dog',
    '그레이트데인': 'great dane',
    '아이리시세터': 'irish setter',
    '고든세터': 'gordon setter',
    '잉글리시세터': 'english setter',
    '포인터': 'pointer',
    '저먼숏헤어포인터': 'german shorthaired pointer',
    '와이머라너': 'weimaraner',
    '비즐라': 'vizsla',
    '브리타니스파니엘': 'brittany spaniel',
    '래브라도들': 'labradoodle',
    '골든두들': 'goldendoodle',
    '슈누들': 'schnoodle',
    '요크푸': 'yorkipoo',
    '코카푸': 'cockapoo',
    '시바푸': 'shiba poo',
    '풍산개': 'pungsan dog',
    '풍산견': 'pungsan',
    '삽살개': 'sapsali',
    '삽살이': 'sapsaree',
    '경주개': 'gyeongju dog',
    '동경이': 'donggyeong',
    '제주개': 'jeju dog',
    '누렁이': 'nureongi',
    '하바니즈': 'havanese',
    '라사압소': 'lhasa apso',
    '티베탄테리어': 'tibetan terrier',
    '노르위치테리어': 'norwich terrier',
    '노퍽테리어': 'norfolk terrier',
    '에어데일테리어': 'airedale terrier',
    '폭스테리어': 'fox terrier',
    '와이어폭스테리어': 'wire fox terrier',
    '스무스폭스테리어': 'smooth fox terrier',
    '레이크랜드테리어': 'lakeland terrier',
    '아이리시테리어': 'irish terrier',
    '보스턴테리어': 'boston terrier',
    '래트테리어': 'rat terrier',
    '아메리칸스태퍼드셔테리어': 'american staffordshire terrier',
    '미니어처슈나우저': 'miniature schnauzer',
    '자이언트슈나우저': 'giant schnauzer',
    '스탠다드슈나우저': 'standard schnauzer',
    '아프간하운드': 'afghan hound',
    '바셋하운드': 'basset hound',
    '블러드하운드': 'bloodhound',
    '비글하운드': 'beagle hound',
    '플랫코티드리트리버': 'flat-coated retriever',
    '체서피크베이리트리버': 'chesapeake bay retriever',
    '노바스코샤덕톨링리트리버': 'nova scotia duck tolling retriever',
    '벨지안그로넨달': 'belgian groenendael',
    '벨지안터뷰런': 'belgian tervuren',
    '벨지안라켄와': 'belgian laekenois',
    '케인코르소': 'cane corso',
    '도고아르헨티노': 'dogo argentino',
    '아나톨리안셰퍼드': 'anatolian shepherd',
    '코몬도르': 'komondor',
    '쿠바스': 'kuvasz',
    '그레이트스위스마운틴독': 'greater swiss mountain dog',
    '엔틀부처마운틴독': 'entlebucher mountain dog',
    '아펜젤러': 'appenzeller',
    '포르투갈워터독': 'portuguese water dog',
    '스패니시워터독': 'spanish water dog',
    '브뤼셀그리펀': 'brussels griffon',
    '아펜핀셔': 'affenpinscher',
    '차이니즈크레스티드': 'chinese crested',
    '재패니즈친': 'japanese chin',
    '실키테리어': 'silky terrier',
    '오스트레일리안테리어': 'australian terrier',
    '댄디딘몬트테리어': 'dandie dinmont terrier',
    '글렌오브이말테리어': 'glen of imaal terrier',
    '시리엄테리어': 'sealyham terrier',
    '웰시테리어': 'welsh terrier',
    '맨체스터테리어': 'manchester terrier',
    '토이맨체스터테리어': 'toy manchester terrier',
    '잉글리시토이테리어': 'english toy terrier',
    '러시안토이': 'russian toy',
    '프라하라터': 'prague ratter',
    '토이폭스테리어': 'toy fox terrier',
    '미니어처불테리어': 'miniature bull terrier',
    '파슨러셀테리어': 'parson russell terrier',
    '보더테리어': 'border terrier',
    '베들링턴테리어': 'bedlington terrier',
    '소프트코티드휘튼테리어': 'soft coated wheaten terrier',
    '아이리시소프트코티드휘튼': 'irish soft coated wheaten',
    '케리블루테리어': 'kerry blue terrier',
    '아이리시울프하운드': 'irish wolfhound',
    '스코티시디어하운드': 'scottish deerhound',
    '살루키': 'saluki',
    '보르조이': 'borzoi',
    '파라오하운드': 'pharaoh hound',
    '이비잔하운드': 'ibizan hound',
    '로디지안리지백': 'rhodesian ridgeback',
    '타이리지백': 'thai ridgeback',
    '플로트코티드리트리버': 'flat coated retriever',
    '컬리코티드리트리버': 'curly coated retriever',
    '라고토로마뇰로': 'lagotto romagnolo',
    '바르베': 'barbet',
    '보비에데플랑드르': 'bouvier des flandres',
    '브리아드': 'briard',
    '보스롱': 'beauceron',
    '피카르디셰퍼드': 'picardy shepherd',
    '화이트스위스셰퍼드': 'white swiss shepherd',
    '화이트셰퍼드': 'white shepherd',
    '킹셰퍼드': 'king shepherd',
    '샤일로셰퍼드': 'shiloh shepherd',
    '체코슬로바키안울프독': 'czechoslovakian wolfdog',
    '사를로스울프독': 'saarloos wolfdog',
    '타마스칸': 'tamaskan',
    '노던이누이트': 'northern inuit',
    '유토나간': 'utonagan',
    '아메리칸에스키모': 'american eskimo',
    '재패니즈스피츠': 'japanese spitz',
    '저먼스피츠': 'german spitz',
    '볼피노이탈리아노': 'volpino italiano',
    '스키퍼키': 'schipperke',
    '키스혼드': 'keeshond',
    '노르웨이언엘크하운드': 'norwegian elkhound',
    '스웨디시발훈드': 'swedish vallhund',
    '아이슬란드셰프독': 'icelandic sheepdog',
    '핀란드라피훈드': 'finnish lapphund',
    '스웨디시라피훈드': 'swedish lapphund',
    '노르웨이언분훈드': 'norwegian buhund',
    '핀란드스피츠': 'finnish spitz',
    '카렐리안베어독': 'karelian bear dog',
    '루소유럽라이카': 'russo-european laika',
    '시베리안라이카': 'siberian laika',
    '야쿠티안라이카': 'yakutian laika',
        // 고양이 품종
    '페르시안': 'persian cat',
    '페르시아': 'persian cat',
    '러시안블루': 'russian blue cat',
    '샴': 'siamese cat',
    '샴고양이': 'siamese',
    '렉돌': 'ragdoll cat',
    '랙돌': 'ragdoll cat',
    '래그돌': 'ragdoll',
    '렉도르': 'ragdoll cat',
    '먼치킨': 'munchkin cat',
    '스핑크스': 'sphynx cat',
    '브리티시숏헤어': 'british shorthair',
    '브리티시': 'british shorthair cat',
    '브숏': 'british shorthair',
    '메인쿤': 'maine coon',
    '메인쿤고양이': 'maine coon cat',
    '스코티시폴드': 'scottish fold',
    '스코티시': 'scottish fold cat',
    '스코폴드': 'scottish fold',
    '아비시니안': 'abyssinian cat',
    '아비시니아': 'abyssinian',
    '벵갈': 'bengal cat',
    '벵갈고양이': 'bengal',
    '노르웨이숲': 'norwegian forest cat',
    '노르웨이숲고양이': 'norwegian forest',
    '터키시앙고라': 'turkish angora',
    '터키쉬앙고라': 'turkish angora cat',
    '친칠라': 'chinchilla cat',
    '엑조틱': 'exotic shorthair',
    '엑조틱숏헤어': 'exotic shorthair cat',
    '데본렉스': 'devon rex',
    '코니시렉스': 'cornish rex',
    '싱가푸라': 'singapura cat',
    '버만': 'birman cat',
    '버미즈': 'burmese cat',
    '라가머핀': 'ragamuffin cat',
    '소말리': 'somali cat',
    '네벨룽': 'nebelung cat',
    '봄베이': 'bombay cat',
    '하이랜드폴드': 'highland fold',
    '셀커크렉스': 'selkirk rex',
    '아메리칸숏헤어': 'american shorthair',
    '아메숏': 'american shorthair cat',
    '아메리칸컬': 'american curl',
    '재패니즈밥테일': 'japanese bobtail',
    '맹크스': 'manx cat',
    
    // 추가 품종들
    '터키시밴': 'turkish van',
    '터키쉬밴': 'turkish van cat',
    '토이거': 'toyger cat',
    '사바나': 'savannah cat',
    '사바나캣': 'savannah',
    '오시캣': 'ocicat',
    '오리엔탈': 'oriental shorthair',
    '오리엔탈숏헤어': 'oriental cat',
    '샤트룩스': 'chartreux cat',
    '발리니즈': 'balinese cat',
    '발리네즈': 'balinese',
    '히말라얀': 'himalayan cat',
    '돈스코이': 'donskoy cat',
    '피터볼드': 'peterbald cat',
    '코랏': 'korat cat',
    '라팜': 'laperm cat',
    '픽시밥': 'pixiebob cat',
    '통키니즈': 'tonkinese cat',
    '시베리안': 'siberian cat',
    '시베리아': 'siberian',
    '쿠릴리안밥테일': 'kurilian bobtail',
    '이집션마우': 'egyptian mau',
    '이집트마우': 'egyptian mau cat',
    '하바나브라운': 'havana brown',
    '스노우슈': 'snowshoe cat',
    '터키시반케디시': 'turkish van kedisi',
    '카오마니': 'khao manee',
    '세레겟티': 'serengeti cat',
    '치토': 'cheetoh cat',
    '민스킨': 'minskin cat',
    '나폴레옹': 'napoleon cat',
    '킨칼로우': 'kinkalow cat',
    '드웰프': 'dwelf cat',
    '뱀부': 'bambino cat',
    '우크라이니안레브코이': 'ukrainian levkoy',
    '요크초콜릿': 'york chocolate',
    '캘리포니아스팽글드': 'california spangled',
    '차우시': 'chausie cat',
    '아메리칸밥테일': 'american bobtail',
    '아메리칸와이어헤어': 'american wirehair',
    '유럽숲고양이': 'european forest cat',
    '오스트레일리안미스트': 'australian mist',
    '버밀라': 'burmilla cat',
    '싱가포르': 'singapore cat',
    '라이코이': 'lykoi cat',
    '늑대고양이': 'lykoi',
    
    // 코리안숏헤어
    '코리안숏헤어': 'korean shorthair',
    '코숏': 'korean shorthair cat',
    '한국고양이': 'korean cat',
    '코리안쇼트헤어': 'korean shorthair'
    };
    
    // 접미사 영어 번역 (컨텍스트 추가)
    const suffixTranslations: { [key: string]: string } = {
        '품종': 'types',
        '종류': 'types', 
        '수명': 'age',
        '특징': 'features',
        '성격': 'personality',
        '크기': 'size',
        '훈련': 'training',
        '분양': 'adoption',
        '가격': 'price',
        '사료': 'food',
        '미용': 'grooming',
        '건강': 'health'
    };
    
    // 핵심 단어 번역
    let translatedCore = coreTranslations[core] || core;
    
    // 접미사에 따른 추가 컨텍스트
    let context = '';
    if (suffix && suffixTranslations[suffix]) {
        context = suffixTranslations[suffix];
    }
    
    // 최종 번역된 쿼리 조합
    let translated = translatedCore;
    if (context) {
        // 접미사에 따라 다른 조합 전략
        if (suffix === '품종' || suffix === '종류') {
            translated = `${translatedCore} ${context} different`;
        } else if (suffix === '수명') {
            translated = `old ${translatedCore} ${context}`;
        } else if (suffix === '특징' || suffix === '성격') {
            translated = `${translatedCore} ${context} cute`;
        } else {
            translated = `${translatedCore} ${context}`;
        }
    }
    
    return { core: core, translated: translated };
}

/**
 * Extract core subject and get simple search terms
 */
function getSimpleImageSearchTerms(keyword: string, topic: string): string[] {
    // 모든 접미사 제거
    const suffixes = [
        // 기존 접미사
        '분양가격', '분양가', '분양', '가격', '비용', '훈련법', '훈련', '방법', 
        '키우기', '관리법', '관리', '특징', '성격', '종류', '추천', '순위',
        '먹이', '사료', '간식', '용품', '병원', '미용', '산책', '놀이',
        '입양', '가정분양', '무료분양', '책임비', '예방접종', '중성화',
        '수명', '크기', '털빠짐', '짖음', '공격성', '지능', '운동량', '품종',
        '육아', '교육', '습관', '버릇', '문제행동', '질병', '건강', '키우는법',
        
        // 추가 접미사
        '새끼', '아기', '아가', '성견', '성묘', '노견', '노묘', '믹스', '믹스견', '믹스묘',
        '암컷', '수컷', '암놈', '수놈', '여아', '남아', '임신', '출산', '발정',
        '교배', '브리더', '켄넬', '캐터리', '혈통서', '챔피언', '대회', '도그쇼',
        '미용컷', '미용스타일', '털깎기', '털관리', '목욕', '샴푸', '빗질', '발톱',
        '양치', '귀청소', '항문낭', '구충제', '심장사상충', '광견병', '종합백신',
        '밥그릇', '급수기', '배변패드', '배변', '배변훈련', '화장실', '모래', '스크래쳐',
        '캣타워', '캣휠', '하네스', '목줄', '리드줄', '가슴줄', '산책줄', '이동가방',
        '이동장', '켄넬', '집', '쿠션', '방석', '침대', '담요', '옷', '신발',
        '장난감', '공', '낚싯대', '레이저', '캣닢', '개껌', '덴탈껌', '영양제',
        '유산균', '오메가3', '관절영양제', '눈물자국', '눈물', '털갈이', '브러싱',
        '알레르기', '피부병', '귀염증', '구토', '설사', '변비', '비만', '다이어트',
        '사회화', '분리불안', '짖기', '물기', '할퀴기', '마킹', '스프레이',
        '호텔', '펜션', '카페', '동반', '여행', '자동차', '비행기', '해외',
        '이름', '작명', '보험', '펫보험', '의료보험', '장례', '화장', '무지개다리',
        '단점', '장점', '주의사항', '초보', '초보자', '입문', '추천견', '추천묘',
        '실내', '실외', '아파트', '마당', '베란다', '울타리', '펜스', '안전',
        '더위', '추위', '여름', '겨울', '에어컨', '히터', '쿨매트', '온열매트',
        '동물병원', '수의사', '진료비', '진료', '검사', '엑스레이', 'CT', '초음파',
        '수술', '마취', '입원', '퇴원', '약', '약물', '처방', '처치',
        '몸무게', '체중', '신장', '체고', '체장', '꼬리', '귀', '발', '발가락',
        '코', '눈', '입', '이빨', '송곳니', '어금니', '젖니', '영구치',
        '색깔', '색상', '무늬', '패턴', '얼룩', '줄무늬', '점박이', '단색',
        '장모종', '단모종', '중모종', '무모종', '곱슬', '직모', '웨이브',
        '소형견', '중형견', '대형견', '초대형견', '토이', '미니', '스탠다드',
        '순종', '믹스', '잡종', '하이브리드', '디자이너독', '디자이너캣',
        '평균수명', '최대수명', '노화', '노령', '시니어', '케어', '돌봄',
        '활동량', '운동', '놀이시간', '휴식', '수면', '잠', '꿈',
        '짝짓기', '번식', '브리딩', '근친', '유전병', '유전자검사', 'DNA',
        '애견카페', '애견동반', '애견호텔', '애견유치원', '애견학교', '애견훈련소',
        '묘카페', '캣카페', '고양이카페', '펫샵', '펫스토어', '동물가게',
        '인스타', '인스타그램', '유튜브', '틱톡', 'SNS', '사진', '영상', '촬영',
        '귀여운', '예쁜', '잘생긴', '멋진', '사랑스러운', '깜찍한', '앙증맞은'
    ];
    
    // 네이버에서 검색될 만한 거의 모든 강아지/고양이 관련 접미사를 추가했습니다!
    
    let coreKeyword = keyword;
    let coreTopic = topic;
    
    // 접미사 제거
    for (const suffix of suffixes) {
        coreKeyword = coreKeyword.replace(suffix, '').trim();
        coreTopic = coreTopic.replace(suffix, '').trim();
    }
    
const breedSearchTerms: { [key: string]: string[] } = {
    // 강아지 품종 (기존 + 추가)
    '말티즈': ['maltese', 'maltese dog', 'white maltese', 'maltese puppy'],
    '말티': ['maltese', 'maltese dog', 'white dog'],
    '푸들': ['poodle', 'toy poodle', 'poodle dog', 'poodle puppy'],
    '토이푸들': ['toy poodle', 'teacup poodle', 'small poodle'],
    '스탠다드푸들': ['standard poodle', 'large poodle', 'poodle'],
    '미니어처푸들': ['miniature poodle', 'mini poodle', 'medium poodle'],
    '미니푸들': ['mini poodle', 'miniature poodle', 'small poodle'],
    '포메': ['pomeranian', 'pom dog', 'fluffy pomeranian', 'pom puppy'],
    '포메라니안': ['pomeranian', 'pom', 'fluffy pomeranian dog'],
    '비숑': ['bichon', 'bichon frise', 'white bichon', 'bichon puppy'],
    '비숑프리제': ['bichon', 'bichon frise', 'white fluffy dog'],
    '시바견': ['shiba', 'shiba inu', 'japanese shiba', 'shiba dog'],
    '시바이누': ['shiba', 'shiba inu', 'japanese dog'],
    '시츄': ['shih tzu', 'shih tzu dog', 'small shih tzu'],
    '요크셔': ['yorkshire', 'yorkie', 'yorkshire terrier', 'yorkie puppy'],
    '요키': ['yorkie', 'yorkshire terrier', 'small yorkie'],
    '치와와': ['chihuahua', 'chihuahua dog', 'tiny chihuahua'],
    '웰시코기': ['corgi', 'welsh corgi', 'pembroke corgi', 'corgi dog'],
    '코기': ['corgi', 'welsh corgi', 'corgi puppy'],
    '닥스훈트': ['dachshund', 'wiener dog', 'sausage dog'],
    '닥스': ['dachshund', 'dachshund dog', 'wiener dog'],
    '골든리트리버': ['golden retriever', 'golden', 'retriever dog'],
    '골든': ['golden retriever', 'golden dog', 'golden puppy'],
    '래브라도': ['labrador', 'lab', 'labrador retriever', 'lab dog'],
    '라브라도': ['labrador', 'labrador dog', 'lab puppy'],
    '허스키': ['husky', 'siberian husky', 'snow dog', 'husky puppy'],
    '시베리안허스키': ['siberian husky', 'husky', 'snow dog'],
    '진돗개': ['jindo', 'korean jindo', 'white jindo dog'],
    '진도견': ['jindo', 'korean jindo', 'jindo dog'],
    '비글': ['beagle', 'beagle dog', 'hound dog', 'beagle puppy'],
    '불독': ['bulldog', 'french bulldog', 'english bulldog'],
    '프렌치불독': ['french bulldog', 'frenchie', 'french bulldog puppy'],
    '잉글리시불독': ['english bulldog', 'british bulldog', 'bulldog'],
    '보더콜리': ['border collie', 'collie', 'border collie dog'],
    '사모예드': ['samoyed', 'samoyed dog', 'white samoyed'],
    '도베르만': ['doberman', 'doberman pinscher', 'doberman dog'],
    '로트와일러': ['rottweiler', 'rottweiler dog', 'rottie'],
    '그레이하운드': ['greyhound', 'greyhound dog', 'racing dog'],
    '달마시안': ['dalmatian', 'dalmatian dog', 'spotted dog'],
    '파피용': ['papillon', 'papillon dog', 'butterfly dog'],
    '차우차우': ['chow chow', 'chow', 'fluffy chow'],
    '슈나우저': ['schnauzer', 'miniature schnauzer', 'schnauzer dog'],
    '코카스파니엘': ['cocker spaniel', 'spaniel', 'cocker dog'],
    '저먼셰퍼드': ['german shepherd', 'shepherd', 'german shepherd dog'],
    '셰퍼드': ['shepherd dog', 'german shepherd', 'shepherd'],
    '퍼그': ['pug', 'pug dog', 'pug puppy'],
    '페키니즈': ['pekingese', 'pekingese dog', 'peke'],
    '말티푸': ['maltipoo', 'maltese poodle', 'maltipoo puppy'],
    '폼피츠': ['pom-pitz', 'pomeranian spitz', 'pomspitz'],
    '폼스키': ['pomsky', 'pomeranian husky', 'pomsky puppy'],
    '복서': ['boxer', 'boxer dog', 'boxer puppy'],
    '그레이트데인': ['great dane', 'giant dog', 'dane'],
    '세인트버나드': ['saint bernard', 'st bernard', 'giant saint bernard'],
    '버니즈마운틴독': ['bernese mountain dog', 'bernese', 'mountain dog'],
    '아키타': ['akita', 'akita inu', 'japanese akita'],
    '풍산개': ['pungsan', 'pungsan dog', 'korean pungsan'],
    '삽살개': ['sapsaree', 'sapsali', 'korean sapsaree'],
    
    // 고양이 품종 (기존 + 추가)
    '페르시안': ['persian cat', 'persian', 'fluffy persian', 'persian kitten'],
    '페르시아': ['persian cat', 'persian kitten', 'fluffy cat'],
    '러시안블루': ['russian blue', 'russian blue cat', 'gray cat', 'blue cat'],
    '샴': ['siamese', 'siamese cat', 'thai cat', 'siamese kitten'],
    '샴고양이': ['siamese', 'siamese cat', 'thai siamese'],
    '렉돌': ['ragdoll', 'ragdoll cat', 'fluffy ragdoll', 'ragdoll kitten'],
    '랙돌': ['ragdoll', 'ragdoll cat', 'fluffy ragdoll cat'],
    '래그돌': ['ragdoll', 'ragdoll cat', 'ragdoll kitten'],
    '렉도르': ['ragdoll', 'ragdoll cat', 'fluffy cat'],
    '먼치킨': ['munchkin', 'munchkin cat', 'short leg cat', 'munchkin kitten'],
    '스핑크스': ['sphynx', 'sphynx cat', 'hairless cat', 'sphinx cat'],
    '브리티시숏헤어': ['british shorthair', 'british cat', 'british shorthair cat'],
    '브리티시': ['british shorthair', 'british cat', 'british kitten'],
    '브숏': ['british shorthair', 'british cat', 'gray british'],
    '메인쿤': ['maine coon', 'maine coon cat', 'large cat', 'maine coon kitten'],
    '메인쿤고양이': ['maine coon', 'maine coon cat', 'giant cat'],
    '스코티시폴드': ['scottish fold', 'scottish cat', 'folded ear cat'],
    '스코티시': ['scottish fold', 'scottish cat', 'scottish kitten'],
    '스코폴드': ['scottish fold', 'folded ear', 'scottish'],
    '아비시니안': ['abyssinian', 'abyssinian cat', 'abyssinian kitten'],
    '아비시니아': ['abyssinian', 'abyssinian cat', 'brown cat'],
    '벵갈': ['bengal', 'bengal cat', 'spotted cat', 'bengal kitten'],
    '벵갈고양이': ['bengal', 'bengal cat', 'leopard cat'],
    '노르웨이숲': ['norwegian forest', 'forest cat', 'norwegian forest cat'],
    '노르웨이숲고양이': ['norwegian forest cat', 'forest cat', 'fluffy forest cat'],
    '터키시앙고라': ['turkish angora', 'angora cat', 'white angora'],
    '터키쉬앙고라': ['turkish angora', 'angora', 'turkish cat'],
    '친칠라': ['chinchilla cat', 'chinchilla persian', 'silver cat'],
    '엑조틱': ['exotic shorthair', 'exotic', 'exotic cat'],
    '엑조틱숏헤어': ['exotic shorthair', 'exotic shorthair cat', 'flat face cat'],
    '데본렉스': ['devon rex', 'devon rex cat', 'curly cat'],
    '코니시렉스': ['cornish rex', 'cornish rex cat', 'rex cat'],
    '싱가푸라': ['singapura', 'singapura cat', 'small cat'],
    '버만': ['birman', 'birman cat', 'sacred birman'],
    '버미즈': ['burmese', 'burmese cat', 'brown burmese'],
    '라가머핀': ['ragamuffin', 'ragamuffin cat', 'fluffy ragamuffin'],
    '소말리': ['somali', 'somali cat', 'fox cat'],
    '네벨룽': ['nebelung', 'nebelung cat', 'gray nebelung'],
    '봄베이': ['bombay', 'bombay cat', 'black cat'],
    '하이랜드폴드': ['highland fold', 'highland fold cat', 'long hair fold'],
    '셀커크렉스': ['selkirk rex', 'selkirk rex cat', 'curly selkirk'],
    '아메리칸숏헤어': ['american shorthair', 'american cat', 'american shorthair cat'],
    '아메숏': ['american shorthair', 'american cat', 'tabby cat'],
    '아메리칸컬': ['american curl', 'american curl cat', 'curled ear cat'],
    '재패니즈밥테일': ['japanese bobtail', 'bobtail cat', 'japanese cat'],
    '맹크스': ['manx', 'manx cat', 'tailless cat'],
    '코리안숏헤어': ['korean shorthair', 'korean cat', 'korean shorthair cat'],
    '코숏': ['korean shorthair', 'korean cat', 'korean domestic cat'],
    '한국고양이': ['korean cat', 'korean shorthair', 'korean domestic'],
    '터키시밴': ['turkish van', 'turkish van cat', 'van cat'],
    '사바나': ['savannah', 'savannah cat', 'tall cat'],
    '시베리안': ['siberian', 'siberian cat', 'siberian forest cat'],
    '토이거': ['toyger', 'toyger cat', 'tiger cat'],
    '오시캣': ['ocicat', 'oci cat', 'spotted ocicat'],
    '오리엔탈': ['oriental shorthair', 'oriental cat', 'oriental'],
    '샤트룩스': ['chartreux', 'chartreux cat', 'blue chartreux'],
    '발리니즈': ['balinese', 'balinese cat', 'long hair siamese'],
    '히말라얀': ['himalayan', 'himalayan cat', 'himalayan persian'],
    '코랏': ['korat', 'korat cat', 'silver blue cat'],
    '통키니즈': ['tonkinese', 'tonkinese cat', 'tonk cat'],
    '이집션마우': ['egyptian mau', 'egyptian cat', 'mau cat'],
    '스노우슈': ['snowshoe', 'snowshoe cat', 'white paw cat'],
    '라이코이': ['lykoi', 'lykoi cat', 'werewolf cat'],
    '늑대고양이': ['lykoi', 'werewolf cat', 'wolf cat']
};


    const searchTerms: string[] = [];
    const addedTerms = new Set<string>();
    
    // 1. 품종별 특화 검색어 추가 (우선순위 높음)
    if (breedSearchTerms[coreTopic]) {
        breedSearchTerms[coreTopic].forEach(term => {
            if (!addedTerms.has(term)) {
                searchTerms.push(term);
                addedTerms.add(term);
            }
        });
    }
    if (breedSearchTerms[coreKeyword] && coreKeyword !== coreTopic) {
        breedSearchTerms[coreKeyword].forEach(term => {
            if (!addedTerms.has(term) && searchTerms.length < 8) {
                searchTerms.push(term);
                addedTerms.add(term);
            }
        });
    }
    
    // 2. 일반 카테고리 추가 (폴백)
    if (searchTerms.length < 4) {
        if (coreTopic.includes('고양이') || coreKeyword.includes('고양이')) {
            ['cat', 'cats', 'kitten', 'cute cat'].forEach(term => {
                if (!addedTerms.has(term)) {
                    searchTerms.push(term);
                    addedTerms.add(term);
                }
            });
        } else if (coreTopic.includes('강아지') || coreKeyword.includes('강아지') || 
                   coreTopic.includes('개') || coreKeyword.includes('개')) {
            ['dog', 'dogs', 'puppy', 'cute dog'].forEach(term => {
                if (!addedTerms.has(term)) {
                    searchTerms.push(term);
                    addedTerms.add(term);
                }
            });
        }
    }
    
    // 3. 기본값 (아무것도 매칭 안 되면)
    if (searchTerms.length === 0) {
        searchTerms.push('pets', 'cute animals', 'dog', 'cat');
    }
    
    return searchTerms;
}

/**
 * Displays images in the gallery
 */
function displayImages(images: any[]) {
    imageGallery.innerHTML = '';
    currentImages = images;
    
    if (images.length === 0) {
        imageGallery.innerHTML = '<p style="text-align: center; color: #666;">이미지를 찾을 수 없습니다.</p>';
        downloadAllButton.disabled = true;
        return;
    }
    
    downloadAllButton.disabled = false;
    
    images.forEach((image, index) => {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-item';
        
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'image-wrapper';
        
        const img = document.createElement('img');
        img.src = image.src.medium;
        img.alt = image.alt || `Image ${index + 1}`;
        img.loading = 'lazy';
        
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'image-refresh-btn';
        refreshBtn.innerHTML = '↻';
        refreshBtn.title = '이미지 교체';
        refreshBtn.onclick = () => refreshSingleImage(index);
        
        imgWrapper.appendChild(img);
        imgWrapper.appendChild(refreshBtn);
        
        const caption = document.createElement('div');
        caption.className = 'image-caption';
        caption.textContent = `사진 ${index + 1}`;
        
        const downloadBtn = document.createElement('a');
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = '다운로드';
        downloadBtn.onclick = async (e) => {
            e.preventDefault();
            try {
                // 이미지 다운로드 및 처리
                const processedBlob = await downloadImageAsBlob(image.src.original);
                const url = URL.createObjectURL(processedBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `image_${index + 1}.jpg`;
                a.click();
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Failed to download image:', error);
            }
        };
        
        imgContainer.appendChild(imgWrapper);
        imgContainer.appendChild(caption);
        imgContainer.appendChild(downloadBtn);
        imageGallery.appendChild(imgContainer);
    });
}

/**
 * Refreshes a single image
 */
async function refreshSingleImage(index: number) {
    const keyword = keywordInput.value.trim();
    const popularTopic = popularTopicInput.value.trim();
    
    if (!keyword && !popularTopic) return;
    
    const imgContainer = imageGallery.children[index] as HTMLElement;
    const refreshBtn = imgContainer.querySelector('.image-refresh-btn') as HTMLButtonElement;
    
    refreshBtn.disabled = true;
    refreshBtn.classList.add('rotating');
    
    // 검색어 목록 가져오기
    const searchTerms = getSimpleImageSearchTerms(keyword, popularTopic);
    
    // 랜덤으로 검색어 선택
    const randomTermIndex = Math.floor(Math.random() * searchTerms.length);
    const searchTerm = searchTerms[randomTermIndex];
    
    // 랜덤 페이지 선택 (1-50)
    const randomPage = Math.floor(Math.random() * 50) + 1;
    
    console.log(`Refreshing single image with: "${searchTerm}" on page ${randomPage}`);
    
    const images = await searchPexelsImages(searchTerm, 5, randomPage);
    
    if (images.length > 0) {
        // 결과 중 랜덤하게 하나 선택
        const newImage = images[Math.floor(Math.random() * images.length)];
        currentImages[index] = newImage;
        
        const img = imgContainer.querySelector('img') as HTMLImageElement;
        const downloadBtn = imgContainer.querySelector('.download-btn') as HTMLAnchorElement;
        
        img.src = newImage.src.medium;
        img.alt = newImage.alt || `Image ${index + 1}`;
        
        // 다운로드 버튼 업데이트
        downloadBtn.onclick = async (e) => {
            e.preventDefault();
            try {
                const processedBlob = await downloadImageAsBlob(newImage.src.original);
                const url = URL.createObjectURL(processedBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `image_${index + 1}.jpg`;
                a.click();
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Failed to download image:', error);
            }
        };
    }
    
    setTimeout(() => {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('rotating');
    }, 500);
}
/**
 * Exports the content and images to a zip file.
 */
async function exportToWord() {
    const content = resultContainer.innerText;
    const keyword = keywordInput.value.trim();
    const topic = popularTopicInput.value.trim();
    
    if (!content) {
        alert('내보낼 콘텐츠가 없습니다.');
        return;
    }

    try {
        const zip = new JSZip();
        
        // 1. Add text content
        const fileName = `${keyword}_${topic}_${new Date().toISOString().slice(0, 10)}.txt`;
        zip.file(fileName, content);
        
        // 2. Add Word document
        const lines = content.split('\n');
        const paragraphs = lines.map(line => {
            return new Paragraph({
                children: [new TextRun({ text: line })]
            });
        });

        const doc = new Document({
            sections: [{
                children: paragraphs,
            }],
        });

        const docBlob = await Packer.toBlob(doc);
        zip.file(`${keyword}_${topic}_${new Date().toISOString().slice(0, 10)}.docx`, docBlob);
        
        // 3. Add images if available
        if (currentImages && currentImages.length > 0) {
            const imageFolder = zip.folder('images');
            
            for (let i = 0; i < currentImages.length; i++) {
                const image = currentImages[i];
                try {
                    const response = await fetch(image.src.large || image.src.medium);
                    const blob = await response.blob();
                    imageFolder?.file(`${keyword}_image_${i + 1}.jpg`, blob);
                } catch (error) {
                    console.error(`Failed to download image ${i + 1}:`, error);
                }
            }
        }
        
        // 4. Generate and download zip
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${keyword}_${topic}_완성패키지.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('원고와 이미지가 압축 파일로 다운로드되었습니다.');
    } catch (error) {
        console.error("Failed to export:", error);
        alert("내보내기에 실패했습니다. 콘솔을 확인해주세요.");
    }
}
/**
 * Main function to generate the blog post with API key rotation.
 */
async function generateBlogPost() {
    const keyword = keywordInput.value.trim();
    const popularTopic = popularTopicInput.value.trim();
    
    if (!keyword || !popularTopic) {
        alert('키워드와 인기주제를 모두 입력해주세요.');
        return;
    }

    generateButton.disabled = true;
    loadingIndicator.classList.remove('hidden');
    resultContainer.textContent = '';
    imageGallery.innerHTML = '';
    updateCharCount();
    
    // 재시도 카운트 리셋
    generationRetryCount = 0;
    
    // 위젯 업데이트
    updateKeywordInfoWidget(keyword, popularTopic, 'generating');

    const prompt = `
Create a Korean blog post optimized for Naver Blog SEO.

Input Information:
- Keyword: ${keyword}
- Popular Topic: ${popularTopic}

CRITICAL REQUIREMENTS:
1. Write EVERYTHING in Korean language
2. Total character count: EXACTLY 1900-2100 characters (excluding spaces)
3. Use pure text only - NO markdown, NO special formatting
4. Each sentence MUST end with a period and line break
5. NEVER exceed 2100 characters or go below 1900 characters

KEYWORD USAGE RULES:
- The popular topic "${popularTopic}" must maintain its word order when used
- If popular topic contains multiple words, they must appear together in order
- Example: If topic is "말티즈 특징", use exactly "말티즈 특징" not "말티즈의 특징" or "말티즈 어떤 특징"
- The words can be part of a longer phrase but must maintain their exact order

EXACT STRUCTURE TO FOLLOW:

1. Title: Create an engaging title with both keyword and popular topic (maintain word order)
2. Repeat title exactly 5 times (one per line)
3. Add 2 empty lines
4. Introduction: Exactly 4 sentences 
   - Sentence 1: Question or situation to grab attention
   - Sentence 2: Explain importance
   - Sentence 3: Personal connection or emotion
   - Sentence 4: Preview content
5. Add 2 empty lines
6. [목차] (with brackets)
   - List exactly 5 sections
   - Each must include the popular topic (maintaining exact word order)
7. Add 2 empty lines
8. Main content: 5 sections, each with:
   - Section title (from table of contents)
   - Exactly 6-7 informative sentences
   - 요약:
   - 5 key points (A, B, C, D, E) - 각 포인트는 10-15자
   - 2 empty lines after each section
9. Conclusion: Exactly 4 sentences 

IMPORTANT: 
- Total output MUST be 1900-2100 characters (excluding spaces)
- Write detailed, informative content in each section
- Use the keyword naturally throughout the text
- Always maintain exact word order for popular topic "${popularTopic}"

작성된 결과물을 한글로 변환했을 때, 공백 제외 글자수가 1750자 이하라면 내용을 300자 정도 추가하십시오.

`;

    // 재시도 로직 - 여러 API 키 순환
    const maxRetries = 15; // API 키가 30개이므로 충분한 재시도
    let lastError: any;
    let fullText = '';
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const apiKey = apiKeyManager.getNextGeminiKey();
        
        try {
            if (attempt > 0) {
                console.log(`Retrying with different API key (attempt ${attempt + 1}/${maxRetries})`);
                // No delay needed - just use different API key
            }
            
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            const contents = {
                parts: [{ text: prompt }],
            };
            
            const responseStream = await ai.models.generateContentStream({
                model: selectedModel,
                contents: contents,
            });

            fullText = '';
            for await (const chunk of responseStream) {
                fullText += chunk.text;
                // Display with line breaks
                const processedText = fullText.replace(/\n/g, '<br>');
                resultContainer.innerHTML = processedText;
                updateCharCount();
            }
            
            // 글자수 및 키워드 체크
            const charCount = fullText.replace(/\s/g, '').length;
            
            // 키워드 카운트 - 특수문자 이스케이프 처리
            let keywordCount = 0;
            if (keyword && fullText) {
                const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const keywordRegex = new RegExp(escapedKeyword, 'gi');
                const keywordMatches = fullText.match(keywordRegex);
                keywordCount = keywordMatches ? keywordMatches.length : 0;
            }
            
            console.log(`[생성 완료] 글자수: ${charCount}자, 키워드: ${keywordCount}회`);
            
            // 키워드 부족 시 보정
            if (keywordCount < 10 && charCount >= 1700 && charCount <= 2600) {
                console.log(`[키워드 부족] ${keywordCount}회, 키워드 추가 시도`);
                generationRetryCount++; // 재시도 카운트 증가
                updateKeywordInfoWidget(keyword, popularTopic, 'generating'); // 위젯 업데이트
                
                const keywordPrompt = `
기존 원고에 키워드를 더 추가해주세요.
현재 "${keyword}"가 ${keywordCount}회 → 목표 12-15회

기존 원고:
${fullText}

수정 지침:
1. 전체 구조와 글자수는 그대로 유지
2. 자연스러운 위치에 "${keyword}" 삽입
3. 문장의 의미가 어색하지 않도록 주의
4. 전체 글자수: ${charCount}자 전후로 유지 (±100자 이내)
5. 키워드를 억지로 넣지 말고 자연스럽게

키워드가 보강된 원고를 작성해주세요.`;

                try {
                    // 새로운 API 키 할당
                    const keywordApiKey = apiKeyManager.getNextGeminiKey();
                    const keywordAi = new GoogleGenAI({ apiKey: keywordApiKey });
                    
                    const keywordResponse = await keywordAi.models.generateContentStream({
                        model: selectedModel,
                        contents: { parts: [{ text: keywordPrompt }] }
                    });
                    
                    fullText = '';
                    for await (const chunk of keywordResponse) {
                        fullText += chunk.text;
                        const processedText = fullText.replace(/\n/g, '<br>');
                        resultContainer.innerHTML = processedText;
                        updateCharCount();
                    }
                    
                    const escapedKeyword2 = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const newKeywordRegex = new RegExp(escapedKeyword2, 'gi');
                    const newKeywordCount = (fullText.match(newKeywordRegex) || []).length;
                    console.log(`[키워드 보완 완료] 키워드: ${newKeywordCount}회`);
                } catch (keywordError) {
                    console.error('키워드 보완 중 오류:', keywordError);
                }
            }
            
            // 글자수 체크 (키워드 보정 후 다시 체크)
            const finalCharCount = fullText.replace(/\s/g, '').length;
            
            if (finalCharCount < 1700) {
                console.log(`[글자수 부족] ${finalCharCount}자, 내용 보완 시도`);
                generationRetryCount++; // 재시도 카운트 증가
                updateKeywordInfoWidget(keyword, popularTopic, 'generating'); // 위젯 업데이트
                
                const expandPrompt = `
기존 원고를 조금만 확장해주세요.
현재 ${finalCharCount}자 → 목표 1900-2000자 (${2000 - finalCharCount}자 추가 필요)

기존 원고:
${fullText}

수정 지침:
1. 전체 구조는 절대 변경하지 마세요
2. 각 섹션에 1-2문장씩만 추가하세요
3. 요약의 각 포인트를 조금 더 구체적으로 작성
4. 제목과 목차는 그대로 유지
5. 최종 글자수: 1900-2000자 (공백 제외)
6. 절대 2100자를 초과하지 마세요

기존 원고에서 조금만 확장한 버전을 작성해주세요.`;

                try {
                    const expandResponse = await ai.models.generateContentStream({
                        model: selectedModel,
                        contents: { parts: [{ text: expandPrompt }] }
                    });
                    
                    fullText = '';
                    for await (const chunk of expandResponse) {
                        fullText += chunk.text;
                        const processedText = fullText.replace(/\n/g, '<br>');
                        resultContainer.innerHTML = processedText;
                        updateCharCount();
                    }
                    
                    const expandedCharCount = fullText.replace(/\s/g, '').length;
                    console.log(`[보완 완료] 글자수: ${expandedCharCount}자`);
                } catch (expandError) {
                    console.error('글자수 보완 중 오류:', expandError);
                }
            } else if (finalCharCount > 2600) {
                console.log(`[글자수 초과] ${finalCharCount}자, 내용 축소 시도`);
                generationRetryCount++; // 재시도 카운트 증가
                updateKeywordInfoWidget(keyword, popularTopic, 'generating'); // 위젯 업데이트
                
                const trimPrompt = `
기존 원고를 조금만 줄여주세요.
현재 ${finalCharCount}자 → 목표 1900-2000자 (${finalCharCount - 2000}자 제거 필요)

기존 원고:
${fullText}

수정 지침:
1. 전체 구조는 절대 변경하지 마세요
2. 각 섹션에서 불필요한 수식어나 반복 제거
3. 요약 포인트를 더 간결하게
4. 제목과 목차는 그대로 유지
5. 핵심 정보는 모두 보존
6. 최종 글자수: 1900-2000자 (공백 제외)

기존 원고에서 조금만 줄인 버전을 작성해주세요.`;

                try {
                    const trimResponse = await ai.models.generateContentStream({
                        model: selectedModel,
                        contents: { parts: [{ text: trimPrompt }] }
                    });
                    
                    fullText = '';
                    for await (const chunk of trimResponse) {
                        fullText += chunk.text;
                        const processedText = fullText.replace(/\n/g, '<br>');
                        resultContainer.innerHTML = processedText;
                        updateCharCount();
                    }
                    
                    const trimmedCharCount = fullText.replace(/\s/g, '').length;
                    console.log(`[축소 완료] 글자수: ${trimmedCharCount}자`);
                } catch (trimError) {
                    console.error('글자수 축소 중 오류:', trimError);
                }
            }
            
            break; // Success, exit retry loop
            
        } catch (error: any) {
            console.error(`Error with API key ${attempt + 1}:`, error);
            lastError = error;
            
            // Mark key as failed if it's an auth error
            if (error?.message?.includes('API key') || error?.message?.includes('401') || error?.message?.includes('403')) {
                apiKeyManager.markGeminiKeyFailed(apiKey);
            }
            
            // 503 과부하 에러시 다른 API 키로 재시도 (2.0 모델 사용 안함)
            if (error?.message?.includes('overloaded') || error?.message?.includes('503')) {
                console.log('API overloaded, trying different API key...');
                // Continue to next iteration with different key
            }
        }
    }
    
    // If all attempts failed
    if (!fullText && lastError) {
        resultContainer.textContent = 'API 과부하로 생성 실패. 잠시 후 다시 시도해주세요.';
        generateButton.disabled = false;
        loadingIndicator.classList.add('hidden');
        updateKeywordInfoWidget(keyword, popularTopic, 'error');
        return;
    }

    try {
        // After content generation, search for relevant images
        imageRefreshCount = 0; // Reset refresh count
        
        const uniqueImages = await ensureTenImages(keyword, popularTopic);
        currentImages = uniqueImages;
        displayImages(uniqueImages);
        
        // Show regenerate button after successful generation
        if (regenerateButton) {
            regenerateButton.classList.remove('hidden');
        }
        
        // 위젯 업데이트 - 완료
        updateKeywordInfoWidget(keyword, popularTopic, 'complete');

    } catch (error) {
        console.error(error);
        resultContainer.textContent = '콘텐츠 생성 중 오류가 발생했습니다. 콘솔을 확인해주세요.';
        updateKeywordInfoWidget(keyword, popularTopic, 'error');
    } finally {
        generateButton.disabled = false;
        loadingIndicator.classList.add('hidden');
        updateCharCount();
    }
}

// --- Event Listeners Setup ---

// Initialize widget (hidden by default)
if (keywordInfoWidget) {
    keywordInfoWidget.classList.add('hidden');
}

// Update widget when input fields change
keywordInput?.addEventListener('input', () => {
    const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
    if (activeTab === 'single') {
        const keyword = keywordInput.value.trim();
        const topic = popularTopicInput.value.trim();
        if (keyword || topic) {
            updateKeywordInfoWidget(keyword, topic, 'idle');
        } else {
            hideKeywordInfoWidget();
        }
    }
});

popularTopicInput?.addEventListener('input', () => {
    const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
    if (activeTab === 'single') {
        const keyword = keywordInput.value.trim();
        const topic = popularTopicInput.value.trim();
        if (keyword || topic) {
            updateKeywordInfoWidget(keyword, topic, 'idle');
        } else {
            hideKeywordInfoWidget();
        }
    }
});

// Single generation button (changed from form submit to button click)
generateButton.addEventListener('click', (e) => {
    e.preventDefault();
    generateBlogPost();
});

// Regenerate button for current content
regenerateButton?.addEventListener('click', async () => {
    const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
    
    if (activeTab === 'multiple' && multipleContentData[currentKeywordIndex]) {
        // Multiple mode - regenerate current keyword
        const item = multipleContentData[currentKeywordIndex];
        const navButton = keywordButtonsContainer?.children[currentKeywordIndex] as HTMLElement;
        
        regenerateButton.disabled = true;
        loadingIndicator.classList.remove('hidden');
        
        // Change button to processing state
        if (navButton) {
            navButton.classList.add('processing');
            navButton.style.backgroundColor = '#FCD34D';
            navButton.style.color = '#000';
        }
        
        try {
            // Generate new content
            const content = await generateContentWithRetry(item.keyword, item.topic, 10, currentKeywordIndex);
            multipleContentData[currentKeywordIndex].content = content;
            resultContainer.innerText = content;
            updateCharCount();
            
            // Generate new images
            const images = await ensureTenImages(item.keyword, item.topic);
            multipleContentData[currentKeywordIndex].images = images;
            displayImages(images);
            
            // Update navigation button color to success
            if (navButton) {
                navButton.classList.remove('processing');
                navButton.style.backgroundColor = '#10B981';
                navButton.style.color = 'white';
            }
            
            // Re-enable regenerate button after successful regeneration
            regenerateButton.disabled = false;
        } catch (error) {
            console.error('Error regenerating content:', error);
            alert('재생성 중 오류가 발생했습니다.');
            
            // Update navigation button color to error
            if (navButton) {
                navButton.classList.remove('processing');
                navButton.style.backgroundColor = '#EF4444';
                navButton.style.color = 'white';
            }
        } finally {
            regenerateButton.disabled = false;
            loadingIndicator.classList.add('hidden');
        }
    } else {
        // Single mode - regenerate entire content
        generateBlogPost();
    }
});

resultContainer.addEventListener('input', updateCharCount);

copyButton.addEventListener('click', () => {
    if (resultContainer.innerText) {
        navigator.clipboard.writeText(resultContainer.innerText)
            .then(() => {
                const originalText = copyButton.querySelector('span')!.textContent;
                copyButton.querySelector('span')!.textContent = '복사됨!';
                setTimeout(() => {
                    copyButton.querySelector('span')!.textContent = originalText;
                }, 2000);
            })
            .catch(err => console.error('Failed to copy text: ', err));
    }
});

exportButton.addEventListener('click', exportToWord);

refreshImagesButton?.addEventListener('click', refreshImages);

// 커스텀 프롬프트 검색 버튼 이벤트
customPromptSearchButton?.addEventListener('click', async () => {
    await searchWithCustomPrompt();
});

// 커스텀 프롬프트 입력 필드에서 엔터 키 처리
customImagePromptInput?.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        await searchWithCustomPrompt();
    }
});

downloadAllButton?.addEventListener('click', async () => {
    await downloadAll();
});

// Initialize
updateCharCount();
downloadAllButton.disabled = true;

/**
 * Search images with custom prompt
 */
async function searchWithCustomPrompt() {
    const customPrompt = customImagePromptInput.value.trim();
    
    if (!customPrompt) {
        alert('검색어를 입력해주세요.');
        return;
    }
    
    customPromptSearchButton.disabled = true;
    refreshImagesButton.disabled = true;
    
    try {
        // 커스텀 프롬프트로 이미지 검색
        const uniqueImages = await ensureTenImages('', '', customPrompt);
        
        if (uniqueImages.length === 0) {
            alert('해당 검색어로 이미지를 찾을 수 없습니다. 다른 검색어를 시도해보세요.');
        } else {
            displayImages(uniqueImages);
            currentImages = uniqueImages;
            
            // 다중 모드인 경우 현재 키워드의 데이터 업데이트
            const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
            if (activeTab === 'multiple' && multipleContentData[currentKeywordIndex]) {
                multipleContentData[currentKeywordIndex].images = uniqueImages;
                multipleContentData[currentKeywordIndex].customImagePrompt = customPrompt;
                currentPageCustomPrompt = customPrompt;
            } else {
                // 단일 모드에서는 현재 페이지의 커스텀 프롬프트 저장
                currentPageCustomPrompt = customPrompt;
            }
        }
    } finally {
        customPromptSearchButton.disabled = false;
        refreshImagesButton.disabled = false;
    }
}

/**
 * Refreshes images with new search results
 */
async function refreshImages() {
    const keyword = keywordInput.value.trim();
    const popularTopic = popularTopicInput.value.trim();
    
    if (!keyword && !popularTopic) {
        alert('키워드 또는 인기주제를 입력해주세요.');
        return;
    }
    
    refreshImagesButton.disabled = true;
    refreshImagesButton.classList.add('rotating');
    
    imageRefreshCount++;
    
    // Get fresh images - 키워드를 우선적으로 사용
    const uniqueImages = await ensureTenImages(
        keyword, 
        popularTopic
    );
    
    displayImages(uniqueImages);
    
    setTimeout(() => {
        refreshImagesButton.disabled = false;
        refreshImagesButton.classList.remove('rotating');
    }, 1000);
}

/**
 * Process image with resizing and effects
 */
async function processImageWithEffects(blob: Blob): Promise<Blob> {
    return new Promise((resolve) => {
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = () => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                    resolve(blob);
                    return;
                }
                
                // 이미지 리사이징 (가로 1800px 제한)
                let width = img.width;
                let height = img.height;
                
                if (width > 1800) {
                    const ratio = 1800 / width;
                    width = 1800;
                    height = Math.round(height * ratio);
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // 랜덤 밝기/대비 조정 (±1~3%)
                const brightnessChange = (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1);
                const contrastChange = (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1);
                const brightness = 100 + brightnessChange;
                const contrast = 100 + contrastChange;
                
                // CSS 필터 적용
                ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
                
                // 이미지 그리기
                ctx.drawImage(img, 0, 0, width, height);
                
                // 노이즈 추가를 위한 이미지 데이터 가져오기
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                
                const noiseCount = 50; // 50개의 노이즈
                const edgeSize = 50; // 가장자리 50px
                
                // 노이즈 추가
                for (let i = 0; i < noiseCount; i++) {
                    let x, y;
                    const side = Math.floor(Math.random() * 4);
                    
                    switch (side) {
                        case 0: // 상단
                            x = Math.floor(Math.random() * width);
                            y = Math.floor(Math.random() * edgeSize);
                            break;
                        case 1: // 우측
                            x = width - Math.floor(Math.random() * edgeSize) - 1;
                            y = Math.floor(Math.random() * height);
                            break;
                        case 2: // 하단
                            x = Math.floor(Math.random() * width);
                            y = height - Math.floor(Math.random() * edgeSize) - 1;
                            break;
                        case 3: // 좌측
                            x = Math.floor(Math.random() * edgeSize);
                            y = Math.floor(Math.random() * height);
                            break;
                    }
                    
                    const pixelIndex = (y * width + x) * 4;
                    
                    if (pixelIndex >= 0 && pixelIndex < data.length - 3) {
                        const variation = 15;
                        const minChange = 5;
                        
                        const getRandomChange = () => {
                            const change = Math.random() * variation * 2 - variation;
                            if (Math.abs(change) < minChange) {
                                return change > 0 ? minChange : -minChange;
                            }
                            return change;
                        };
                        
                        data[pixelIndex] = Math.max(0, Math.min(255, data[pixelIndex] + getRandomChange()));
                        data[pixelIndex + 1] = Math.max(0, Math.min(255, data[pixelIndex + 1] + getRandomChange()));
                        data[pixelIndex + 2] = Math.max(0, Math.min(255, data[pixelIndex + 2] + getRandomChange()));
                    }
                }
                
                // 수정된 이미지 데이터 적용
                ctx.putImageData(imageData, 0, 0);
                
                // blob으로 변환
                canvas.toBlob((newBlob) => {
                    resolve(newBlob || blob);
                }, 'image/jpeg', 0.95);
            };
            
            img.src = reader.result as string;
        };
        
        reader.readAsDataURL(blob);
    });
}

/**
 * Downloads an image and returns it as a blob
 */
async function downloadImageAsBlob(url: string): Promise<Blob> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        // 이미지 처리 적용
        const processedBlob = await processImageWithEffects(blob);
        return processedBlob;
    } catch (error) {
        console.error('Error downloading image:', error);
        throw error;
    }
}

/**
 * Creates a ZIP file with document and images
 */
async function downloadAll() {
    // Check if we're in multiple mode
    const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
    
    if (activeTab === 'multiple' && multipleContentData.length > 0 && multipleContentData.some(item => item.content)) {
        // Multiple mode - download all contents
        await exportMultipleContents();
        return;
    }
    
    // Single mode - original download logic
    const content = resultContainer.innerText;
    if (!content || currentImages.length === 0) {
        alert('원고와 이미지가 모두 준비되어야 합니다.');
        return;
    }
    
    downloadAllButton.disabled = true;
    downloadAllButton.innerHTML = '<span>다운로드 준비 중...</span>';
    
    try {
        const zip = new JSZip();
        const keyword = keywordInput.value.trim();
        const date = new Date().toISOString().slice(0, 10);
        
        // Add text document
        zip.file(`원고_${keyword}_${date}.txt`, content);
        
        // Create Word document
        const lines = content.split('\n');
        const paragraphs = lines.map(line => {
            return new Paragraph({
                children: [new TextRun({ text: line })]
            });
        });
        
        const doc = new Document({
            sections: [{
                children: paragraphs,
            }],
        });
        
        const docBlob = await Packer.toBlob(doc);
        zip.file(`원고_${keyword}_${date}.docx`, docBlob);
        
        // Add images (병렬 처리)
        const imageFolder = zip.folder('images');
        
        // 이미지를 5개씩 배치 처리
        const BATCH_SIZE = 5;
        for (let i = 0; i < currentImages.length; i += BATCH_SIZE) {
            const batch = currentImages.slice(i, Math.min(i + BATCH_SIZE, currentImages.length));
            
            downloadAllButton.innerHTML = `<span>이미지 다운로드 중... (${i + 1}/${currentImages.length})</span>`;
            
            const downloadPromises = batch.map(async (image, idx) => {
                const imageIndex = i + idx;
                try {
                    // large 사이즈 사용 (original 대신) - 품질과 속도 균형
                    const imageUrl = image.src.large || image.src.medium || image.src.original;
                    const imageBlob = await downloadImageAsBlob(imageUrl);
                    return { blob: imageBlob, index: imageIndex };
                } catch (error) {
                    console.error(`Failed to download image ${imageIndex + 1}:`, error);
                    return null;
                }
            });
            
            const results = await Promise.all(downloadPromises);
            results.forEach(result => {
                if (result) {
                    imageFolder?.file(`image_${result.index + 1}.jpg`, result.blob);
                }
            });
        }
        
        // Generate ZIP file (압축 레벨 조정)
        downloadAllButton.innerHTML = '<span>압축 파일 생성 중...</span>';
        const zipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 1  // 빠른 압축
            }
        });
        
        // Download ZIP
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `네이버블로그_${keyword}_${date}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error creating ZIP:', error);
        alert('다운로드 중 오류가 발생했습니다.');
    } finally {
        downloadAllButton.disabled = false;
        downloadAllButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>원고 + 이미지 통합 다운로드 (ZIP)</span>
        `;
    }
}
/**
 * Ensures we have exactly 10 images by fetching more if needed
 */
async function ensureTenImages(keyword: string, popularTopic: string, customPrompt?: string): Promise<any[]> {
    const allImages: any[] = [];
    const seenIds = new Set<string>();
    
    // 이미지 새로고침 시 페이지 오프셋 추가
    const pageOffset = imageRefreshCount * 5 || 0;
    
    // 커스텀 프롬프트가 있으면 그것만 사용
    if (customPrompt && customPrompt.trim()) {
        // 랜덤 페이지에서 시작
        const startPage = Math.floor(Math.random() * 10) + 1 + pageOffset;
        
        for (let page = startPage; page <= startPage + 10 && allImages.length < 10; page++) {
            const images = await searchPexelsImages(customPrompt.trim(), 10, page);
            for (const img of images) {
                if (!seenIds.has(img.id)) {
                    seenIds.add(img.id);
                    allImages.push(img);
                    if (allImages.length >= 10) break;
                }
            }
        }
        
        // 결과를 섞어서 다양성 확보
        return allImages.sort(() => Math.random() - 0.5).slice(0, 10);
    }
    
    // Primary queries - 간단한 핵심 검색어만 사용
    const searchTerms = getSimpleImageSearchTerms(keyword, popularTopic);
    
    // 각 검색어마다 랜덤 페이지 사용
    for (let i = 0; i < searchTerms.length && allImages.length < 15; i++) {
        const term = searchTerms[i];
        
        // 1-30 사이의 랜덤 페이지 선택
        const randomPage = Math.floor(Math.random() * 30) + 1 + pageOffset;
        
        console.log(`Searching: "${term}" on page ${randomPage}`);
        
        const images = await searchPexelsImages(term, 5, randomPage);
        
        // 중복 제거하며 추가
        for (const img of images) {
            if (!seenIds.has(img.id)) {
                seenIds.add(img.id);
                allImages.push(img);
            }
        }
    }
    
    // 결과를 섞어서 다양성 확보
    let shuffled = allImages.sort(() => Math.random() - 0.5);
    
    // 그래도 부족하면 관련 카테고리로 채우기
    if (shuffled.length < 10) {
        const fallbackTerms = ['cute animals', 'pets', 'adorable pets', 'pet photography'];
        for (const term of fallbackTerms) {
            if (shuffled.length >= 10) break;
            
            const randomPage = Math.floor(Math.random() * 20) + 1;
            const images = await searchPexelsImages(term, 5, randomPage);
            
            for (const img of images) {
                if (!seenIds.has(img.id)) {
                    seenIds.add(img.id);
                    shuffled.push(img);
                    if (shuffled.length >= 10) break;
                }
            }
        }
    }
    
    return shuffled.slice(0, 10);
}



// --- Parse Excel File ---
async function parseExcelFile(file: File) {
    try {
        const XLSX = (window as any).XLSX;
        if (!XLSX) {
            // Load XLSX library dynamically
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            document.head.appendChild(script);
            await new Promise(resolve => script.onload = resolve);
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = (window as any).XLSX.read(data, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = (window as any).XLSX.utils.sheet_to_json(firstSheet);
            
            // Process Excel data
            multipleContentData = jsonData.slice(0, 30).map((row: any) => ({
                keyword: row['키워드'] || row['keyword'] || '',
                topic: row['인기주제'] || row['topic'] || row['popular_topic'] || ''
            })).filter((item: any) => item.keyword && item.topic);
            
            if (multipleContentData.length === 0) {
                alert('유효한 데이터가 없습니다. 엑셀 파일 형식을 확인해주세요.');
                generateMultipleBtn.disabled = true;
            }
        };
        reader.readAsBinaryString(file);
    } catch (error) {
        console.error('Excel parsing error:', error);
        alert('엑셀 파일 읽기 실패. 파일 형식을 확인해주세요.');
    }
}

function createAndDownloadExcel(data: string[][]) {
    const XLSX = (window as any).XLSX;
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'blog_content_template.xlsx');
}
// --- Generate Multiple Contents --- (OLD - COMMENTED OUT)
/* generateMultipleBtn.addEventListener('click', async () => {
    if (multipleContentData.length === 0) {
        alert('엑셀 파일을 먼저 업로드해주세요.');
        return;
    }
    
    generateMultipleBtn.disabled = true;
    loadingIndicator.classList.remove('hidden');
    keywordNavigation.classList.remove('hidden');
    
    // Create keyword navigation buttons
    keywordButtonsContainer.innerHTML = '';
    multipleContentData.forEach((item, index) => {
        const button = document.createElement('button');
        button.className = 'keyword-btn';
        button.textContent = item.keyword;
        button.innerHTML = `${item.keyword} <span class="count">${index + 1}</span>`;
        button.addEventListener('click', () => showKeywordContent(index));
        keywordButtonsContainer.appendChild(button);
    });
    
    // Generate content for each keyword
    for (let i = 0; i < multipleContentData.length; i++) {
        const item = multipleContentData[i];
        generateMultipleBtn.innerHTML = `<span>생성 중... (${i + 1}/${multipleContentData.length})</span>`;
        
        try {
            // Generate content
            const content = await generateContent(item.keyword, item.topic);
            multipleContentData[i].content = content;
            
            // Generate images
            const images = await ensureTenImages(item.keyword, item.topic);
            multipleContentData[i].images = images;
            
        } catch (error) {
            console.error(`Error generating content for ${item.keyword}:`, error);
            multipleContentData[i].content = '콘텐츠 생성 실패';
            multipleContentData[i].images = [];
        }
    }
    
    loadingIndicator.classList.add('hidden');
    generateMultipleBtn.disabled = false;
    generateMultipleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span class="button-text">다중 콘텐츠 생성하기</span>
    `;
    
    // 첫 번째 탭을 표시하지 않고 현재 탭 유지
}); */
// --- Show Keyword Content ---
function showKeywordContent(index: number) {
    currentKeywordIndex = index;
    const item = multipleContentData[index];
    
    if (!item) return;
    
    // 처리중이어도 표시 가능하게 변경 - 경고 제거
    // const navButton = keywordButtonsContainer?.children[index] as HTMLElement;
    // if (navButton && navButton.classList.contains('processing')) {
    //     alert('이 콘텐츠는 현재 생성 중입니다. 잠시만 기다려주세요.');
    //     return;
    // }
    
    // Update navigation buttons - 요소가 있는지 확인
    const buttonsContainer = keywordButtonsContainer || document.getElementById('keyword-buttons');
    if (buttonsContainer) {
        const buttons = buttonsContainer.querySelectorAll('.keyword-btn');
        buttons.forEach((btn, i) => {
            btn.classList.remove('active');
            if (i === index) {
                btn.classList.add('active');
            }
        });
    }
    
    // Update widget with current keyword info
    const navButton = keywordButtonsContainer?.children[index] as HTMLElement;
    const isProcessing = navButton && navButton.classList.contains('processing');
    const status = isProcessing ? 'generating' : 
                  item.content ? 
                  (item.content.startsWith('[생성 실패]') ? 'error' : 'complete') : 
                  'idle';
    
    // 해당 키워드의 재시도 횟수 가져오기
    const retryCount = item.retryCount || 0;
    updateKeywordInfoWidget(item.keyword, item.topic, status, retryCount);
    
    // Update content - 처리중이어도 기존 내용이 있으면 표시
    if (item.content && !item.content.startsWith('[생성 실패]')) {
        resultContainer.innerText = item.content;
        updateCharCount();
        
        // Show regenerate button for successful content
        if (regenerateButton) {
            regenerateButton.classList.remove('hidden');
            regenerateButton.disabled = isProcessing; // 처리중일 때만 비활성화
        }
    } else if (item.content && item.content.startsWith('[생성 실패]')) {
        resultContainer.innerText = item.content;
        updateCharCount();
        
        // Show regenerate button for failed content too
        if (regenerateButton) {
            regenerateButton.classList.remove('hidden');
            regenerateButton.disabled = isProcessing; // 처리중일 때만 비활성화
        }
    } else if (isProcessing) {
        // 처리중이지만 내용이 없을 때
        resultContainer.innerText = '콘텐츠를 생성하고 있습니다... 잠시만 기다려주세요.';
        updateCharCount();
        
        // Hide regenerate button during processing
        if (regenerateButton) {
            regenerateButton.classList.add('hidden');
        }
    } else {
        resultContainer.innerText = '콘텐츠가 아직 생성되지 않았습니다.';
        updateCharCount();
        
        // Hide regenerate button if no content
        if (regenerateButton) {
            regenerateButton.classList.add('hidden');
        }
    }
    
    // Update images
    if (item.images && item.images.length > 0) {
        currentImages = item.images;
        displayImages(currentImages);
    } else {
        imageGallery.innerHTML = '<p style="text-align: center; color: #666;">이미지가 아직 생성되지 않았습니다.</p>';
    }
    
    // Update custom prompt if exists
    if (item.customImagePrompt) {
        customImagePromptInput.value = item.customImagePrompt;
        currentPageCustomPrompt = item.customImagePrompt;
    } else {
        customImagePromptInput.value = '';
        currentPageCustomPrompt = '';
    }
    
    // Update form inputs (for reference)
    keywordInput.value = item.keyword;
    popularTopicInput.value = item.topic;
}

// --- Export Multiple Contents to ZIP ---
async function exportMultipleContents() {
    if (multipleContentData.length === 0 || !multipleContentData.some(item => item.content)) {
        alert('생성된 콘텐츠가 없습니다.');
        return;
    }
    
    downloadAllButton.disabled = true;
    downloadAllButton.innerHTML = '<span>ZIP 파일 생성 중...</span>';
    
    try {
        const zip = new JSZip();
        const date = new Date().toISOString().slice(0, 10);
        
        // 이미지 다운로드를 병렬로 처리
        const BATCH_SIZE = 5; // 동시에 5개씩 다운로드
        let totalImages = 0;
        let downloadedImages = 0;
        
        // 전체 이미지 수 계산
        multipleContentData.forEach(item => {
            if (item.images) totalImages += item.images.length;
        });
        
        for (let i = 0; i < multipleContentData.length; i++) {
            const item = multipleContentData[i];
            if (!item.content) continue;
            
            const folderName = `${String(i + 1).padStart(2, '0')}_${item.keyword.replace(/[^가-힣a-zA-Z0-9]/g, '_')}`;
            const folder = zip.folder(folderName);
            
            // Add content as both txt and docx
            folder?.file(`원고_${item.keyword}.txt`, item.content);
            
            // Create Word document
            const lines = item.content.split('\n');
            const paragraphs = lines.map(line => {
                return new Paragraph({
                    children: [new TextRun({ text: line })]
                });
            });
            
            const doc = new Document({
                sections: [{
                    children: paragraphs,
                }],
            });
            
            const docBlob = await Packer.toBlob(doc);
            folder?.file(`원고_${item.keyword}.docx`, docBlob);
            
            // 이미지 병렬 다운로드
            if (item.images && item.images.length > 0) {
                const imageFolder = folder?.folder('images');
                
                // 배치 처리
                for (let j = 0; j < item.images.length; j += BATCH_SIZE) {
                    const batch = item.images.slice(j, Math.min(j + BATCH_SIZE, item.images.length));
                    
                    // 병렬 다운로드
                    const downloadPromises = batch.map(async (image, idx) => {
                        const imageIndex = j + idx;
                        downloadedImages++;
                        
                        // 진행률 표시
                        const progress = Math.round((downloadedImages / totalImages) * 100);
                        downloadAllButton.innerHTML = `<span>이미지 다운로드 중... ${progress}%</span>`;
                        
                        try {
                            // medium 크기 사용 (원본 대신) - 속도 대폭 개선
                            const imageUrl = image.src.large || image.src.medium || image.src.original;
                            const imageBlob = await downloadImageAsBlob(imageUrl);
                            return { 
                                blob: imageBlob, 
                                index: imageIndex 
                            };
                        } catch (error) {
                            console.error(`Failed to download image ${imageIndex + 1}:`, error);
                            return null;
                        }
                    });
                    
                    // 배치 결과 처리
                    const results = await Promise.all(downloadPromises);
                    results.forEach(result => {
                        if (result) {
                            imageFolder?.file(`image_${String(result.index + 1).padStart(2, '0')}.jpg`, result.blob);
                        }
                    });
                }
            }
        }
        
        // Generate and download ZIP
        downloadAllButton.innerHTML = '<span>압축 파일 생성 중...</span>';
        
        // 압축 레벨 조정 (속도 우선)
        const zipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 1  // 1-9, 낮을수록 빠름
            }
        });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `네이버블로그_다중생성_${date}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
        
    } catch (error) {
        console.error('Error creating ZIP:', error);
        alert('다운로드 중 오류가 발생했습니다.');
    } finally {
        downloadAllButton.disabled = false;
        updateDownloadButtonText();
    }
}
// --- Generate Content (for multiple generation) with API key rotation ---
async function generateContent(keyword: string, popularTopic: string, itemIndex?: number): Promise<string> {
    const apiKey = apiKeyManager.getNextGeminiKey();
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // 다중 생성 모드에서는 현재 선택된 탭일 때만 위젯 업데이트
    if (itemIndex === undefined || itemIndex === currentKeywordIndex) {
        updateKeywordInfoWidget(keyword, popularTopic, 'generating');
    }
    
    const prompt = `
Create a Korean blog post optimized for Naver Blog SEO.

Input Information:
- Keyword: ${keyword}
- Popular Topic: ${popularTopic}

CRITICAL REQUIREMENTS:
1. Write EVERYTHING in Korean language
2. Total character count: EXACTLY 1900-2100 characters (excluding spaces)
3. Use pure text only - NO markdown, NO special formatting
4. Each sentence MUST end with a period and line break
5. NEVER exceed 2100 characters or go below 1900 characters

KEYWORD USAGE RULES:
- The popular topic "${popularTopic}" must maintain its word order when used
- If popular topic contains multiple words, they must appear together in order
- Example: If topic is "말티즈 특징", use exactly "말티즈 특징" not "말티즈의 특징" or "말티즈 어떤 특징"
- The words can be part of a longer phrase but must maintain their exact order

EXACT STRUCTURE TO FOLLOW:

1. Title: Create an engaging title with both keyword and popular topic (maintain word order)
2. Repeat title exactly 5 times (one per line)
3. Add 2 empty lines
4. Introduction: Exactly 4 sentences 
   - Sentence 1: Question or situation to grab attention
   - Sentence 2: Explain importance
   - Sentence 3: Personal connection or emotion
   - Sentence 4: Preview content
5. Add 2 empty lines
6. [목차] (with brackets)
   - List exactly 5 sections
   - Each must include the popular topic (maintaining exact word order)
7. Add 2 empty lines
8. Main content: 5 sections, each with:
   - Section title (from table of contents)
   - Exactly 6-7 informative sentences
   - 요약:
   - 5 key points (A, B, C, D, E) - 각 포인트는 10-15자
   - 2 empty lines after each section
9. Conclusion: Exactly 4 sentences

IMPORTANT: 
- Total output MUST be 1900-2100 characters (excluding spaces)
- Each section should be approximately 280-320 characters
- Write detailed, informative content in each section
- Use the keyword naturally throughout the text
- Always maintain exact word order for popular topic "${popularTopic}"

작성된 결과물을 한글로 변환했을 때, 공백 제외 글자수가 1750자 이하라면 내용을 300자 정도 추가하십시오.

`;

    try {
        const contents = {
            parts: [{ text: prompt }],
        };
        
        const responseStream = await ai.models.generateContentStream({
            model: selectedModel, // 사용자가 선택한 모델 사용
            contents: contents,
        });

        let fullText = '';
        for await (const chunk of responseStream) {
            fullText += chunk.text;
        }
        
        // 글자수 및 키워드 체크 (공백 제거)
        const charCount = fullText.replace(/\s/g, '').length;
        
        // 키워드 카운트 - 정확한 매칭을 위해 정규표현식 개선
        let keywordCount = 0;
        if (keyword && fullText) {
            // 특수문자 이스케이프 처리
            const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const keywordRegex = new RegExp(escapedKeyword, 'gi');
            const keywordMatches = fullText.match(keywordRegex);
            keywordCount = keywordMatches ? keywordMatches.length : 0;
        }
        
        // 인기주제 카운트 및 순서 체크
        let topicCount = 0;
        let topicOrderValid = true;
        if (popularTopic && fullText) {
            // 특수문자 이스케이프 처리
            const escapedTopic = popularTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const topicRegex = new RegExp(escapedTopic, 'gi');
            const topicMatches = fullText.match(topicRegex);
            topicCount = topicMatches ? topicMatches.length : 0;
            
            // 인기주제가 여러 단어로 구성된 경우 순서 체크
            const topicWords = popularTopic.split(' ').filter(w => w.length > 0);
            if (topicWords.length > 1) {
                // 각 단어를 이스케이프 처리
                const escapedWords = topicWords.map(word => 
                    word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                );
                
                // 순서가 깨진 패턴 체크 (단어 사이에 다른 단어가 있는 경우)
                // 예: "말티즈 특징" -> "말티즈.*?특징"이 아닌 다른 패턴
                for (let i = 0; i < escapedWords.length - 1; i++) {
                    const brokenPattern = `${escapedWords[i]}[^${escapedWords[i+1][0]}]+${escapedWords[i+1]}`;
                    const brokenRegex = new RegExp(brokenPattern, 'gi');
                    if (brokenRegex.test(fullText)) {
                        // 단어 사이에 다른 내용이 있는 경우 발견
                        const validPattern = escapedWords.join('\\s*');
                        const validRegex = new RegExp(validPattern, 'gi');
                        const validMatches = fullText.match(validRegex) || [];
                        
                        // 정상 패턴보다 깨진 패턴이 더 많으면 문제
                        if (validMatches.length < topicCount / 2) {
                            topicOrderValid = false;
                            break;
                        }
                    }
                }
            }
        }
        
        console.log(`[생성 완료] ${keyword} - 글자수: ${charCount}자, 키워드: ${keywordCount}회, 인기주제: ${topicCount}회${!topicOrderValid ? ' (순서위반)' : ''}`);
        
        // UI에 상세 로그 추가
        let logMessage = `${keyword}: ${charCount}자, 키워드 ${keywordCount}회, 인기주제 ${topicCount}회`;
        let logType: 'info' | 'warning' | 'error' | 'success' = 'info';
        
        if (charCount < 1700) {
            logMessage += ' (글자수 부족 - 재시도 필요)';
            logType = 'warning';
            throw new Error(`글자수 부족: ${charCount}자`);
        } else if (charCount > 2600) {
            logMessage += ' (글자수 초과 - 재시도 필요)';
            logType = 'warning';
            throw new Error(`글자수 초과: ${charCount}자`);
        } else if (keywordCount < 10) {
            logMessage += ' (키워드 부족 - 재시도 필요)';
            logType = 'warning';
            throw new Error(`키워드 부족: ${keywordCount}회`);
        } else if (topicCount < 5) {
            logMessage += ' (인기주제 부족 - 재시도 필요)';
            logType = 'warning';
            throw new Error(`인기주제 부족: ${topicCount}회`);
        } else if (!topicOrderValid) {
            logMessage += ' (인기주제 순서 위반 - 재시도 필요)';
            logType = 'warning';
            throw new Error(`인기주제 순서 위반`);
        } else {
            logType = 'success';
        }
        
        addGenerationLog(logMessage, logType);
        
        // 다중 생성 모드에서는 현재 선택된 탭일 때만 위젯 업데이트
        if (itemIndex === undefined || itemIndex === currentKeywordIndex) {
            updateKeywordInfoWidget(keyword, popularTopic, 'complete');
        }
        
        return fullText;
    } catch (error: any) {
        console.error('Generation error:', error);
        
        // API 키 실패 처리
        if (error?.message?.includes('API key') || error?.message?.includes('401')) {
            apiKeyManager.markGeminiKeyFailed(apiKey);
        }
        
        // 다중 생성 모드에서는 현재 선택된 탭일 때만 위젯 업데이트
        if (itemIndex === undefined || itemIndex === currentKeywordIndex) {
            updateKeywordInfoWidget(keyword, popularTopic, 'error');
        }
        throw error;
    }
}
// Update download button text based on mode
const updateDownloadButtonText = () => {
    const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
    
    if (activeTab === 'multiple' && multipleContentData.length > 0 && multipleContentData.some(item => item.content)) {
        const validCount = multipleContentData.filter(item => item.content).length;
        downloadAllButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>모든 콘텐츠 통합 다운로드 (${validCount}개)</span>
        `;
    } else {
        downloadAllButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>원고 + 이미지 통합 다운로드 (ZIP)</span>
        `;
    }
};

// --- Generate Content with Retry (for multiple generation) ---
async function generateContentWithRetry(keyword: string, popularTopic: string, maxRetries: number = 10, itemIndex?: number): Promise<string> {
    let lastError: any;
    let retryCount = 0;
    
    console.log(`[생성 시작] ${keyword}`);
    addGenerationLog(`[생성 시작] ${keyword}`, 'info');
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                retryCount++;
                // 인덱스가 있으면 해당 아이템의 재시도 횟수 업데이트
                if (itemIndex !== undefined && multipleContentData[itemIndex]) {
                    multipleContentData[itemIndex].retryCount = retryCount;
                }
                
                if (lastError?.message?.includes('글자수')) {
                    if (lastError.message.includes('부족')) {
                        const msg = `[재생성] ${keyword} - 글자수 부족으로 ${retryCount}번째 재생성`;
                        console.log(msg);
                        addGenerationLog(msg, 'warning');
                    } else if (lastError.message.includes('초과')) {
                        const msg = `[재생성] ${keyword} - 글자수 초과로 ${retryCount}번째 재생성`;
                        console.log(msg);
                        addGenerationLog(msg, 'warning');
                    }
                } else if (lastError?.message?.includes('키워드')) {
                    const msg = `[재생성] ${keyword} - 키워드 부족으로 ${retryCount}번째 재생성`;
                    console.log(msg);
                    addGenerationLog(msg, 'warning');
                } else {
                    const msg = `[재시도] ${keyword} - 다른 API 키로 재시도 (${retryCount}회)`;
                    console.log(msg);
                    addGenerationLog(msg, 'info');
                }
            }
            
            const content = await generateContent(keyword, popularTopic, itemIndex);
            
            // 성공시 재시도 횟수 포함하여 로그
            const msg = retryCount > 0 ? 
                `[생성 성공] ${keyword} (재시도 ${retryCount}회)` : 
                `[생성 성공] ${keyword}`;
            console.log(msg);
            addGenerationLog(msg, 'success');
            
            // 인덱스가 있으면 최종 재시도 횟수 저장
            if (itemIndex !== undefined && multipleContentData[itemIndex]) {
                multipleContentData[itemIndex].retryCount = retryCount;
            }
            
            return content;
        } catch (error: any) {
            lastError = error;
            
            // 429 할당량 초과 에러 처리
            if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
                const msg = `[할당량 초과] ${keyword} - 이 모델의 할당량을 초과했습니다. 다른 모델 사용을 권장합니다.`;
                console.error(msg);
                addGenerationLog(msg, 'error');
                
                // 2.0 모델 사용시 2.5로 자동 전환 제안
                if (selectedModel === 'gemini-2.0-flash-exp') {
                    const switchMsg = `💡 Gemini 2.5 Flash 모델로 전환하면 더 많은 할당량을 사용할 수 있습니다.`;
                    addGenerationLog(switchMsg, 'warning');
                }
                
                // 재시도 대기 (429 에러는 보통 대기 필요)
                if (error.message.includes('retryDelay')) {
                    const delayMatch = error.message.match(/"retryDelay":\s*"(\d+)s"/);
                    if (delayMatch) {
                        const delay = parseInt(delayMatch[1]) * 1000;
                        const waitMsg = `[대기] ${Math.round(delay/1000)}초 대기 후 재시도...`;
                        addGenerationLog(waitMsg, 'info');
                        await new Promise(resolve => setTimeout(resolve, Math.min(delay, 10000))); // 최대 10초 대기
                    }
                }
            }
            // 503 과부하시 즉시 다른 API 키로 재시도
            else if (error?.message?.includes('overloaded') || error?.message?.includes('503')) {
                const msg = `[과부하] ${keyword} - 다른 API 키로 즉시 재시도`;
                console.log(msg);
                addGenerationLog(msg, 'warning');
            }
        }
    }
    
    const msg = `[생성 실패] ${keyword} - ${maxRetries}회 시도 후 최종 실패`;
    console.error(msg);
    addGenerationLog(msg, 'error');
    throw lastError;
}
// --- Initialize Tab functionality after DOM loads ---
setTimeout(() => {
    // Get tab elements and assign to global variables
    tabButtons = document.querySelectorAll('.tab-button') as NodeListOf<HTMLButtonElement>;
    tabContents = document.querySelectorAll('.tab-content') as NodeListOf<HTMLDivElement>;
    excelFileInput = document.getElementById('excel-file') as HTMLInputElement;
    excelUploadBtn = document.getElementById('excel-upload-btn') as HTMLButtonElement;
    fileNameDisplay = document.getElementById('file-name') as HTMLElement;
    downloadTemplateBtn = document.getElementById('download-template') as HTMLButtonElement;
    generateMultipleBtn = document.getElementById('generate-multiple-button') as HTMLButtonElement;
    keywordNavigation = document.getElementById('keyword-navigation') as HTMLDivElement;
    keywordButtonsContainer = document.getElementById('keyword-buttons') as HTMLDivElement;
    
    // 동시 생성 개수 관련 요소 초기화
    concurrentCountInput = document.getElementById('concurrent-count') as HTMLInputElement;
    
    // AI 모델 선택 요소 초기화
    aiModelSelect = document.getElementById('ai-model') as HTMLSelectElement;
    const aiModelSingleSelect = document.getElementById('ai-model-single') as HTMLSelectElement;
    const speedBadge = document.getElementById('speed-badge') as HTMLSpanElement;
    const qualityBadge = document.getElementById('quality-badge') as HTMLSpanElement;
    const modelDescription = document.getElementById('model-description') as HTMLParagraphElement;
    
    // 모델 선택 이벤트 함수
    const handleModelChange = (modelValue: string) => {
        selectedModel = modelValue;
        const config = modelConfigs[selectedModel];
        
        if (config) {
            // 배지 업데이트 (다중 생성 탭에만 있음)
            if (speedBadge) {
                speedBadge.textContent = config.speed;
                speedBadge.style.background = config.speedBadgeColor;
            }
            if (qualityBadge) {
                qualityBadge.textContent = config.quality;
                qualityBadge.style.background = config.qualityBadgeColor;
            }
            // 설명 업데이트 (다중 생성 탭에만 있음)
            if (modelDescription) {
                modelDescription.textContent = config.description;
            }
            
            // 할당량에 따른 경고
            if (config.quotaPerMinute && config.quotaPerMinute <= 10) {
                const warningMsg = `⚠️ ${config.name}은(는) 분당 ${config.quotaPerMinute}개만 생성 가능합니다. 대량 생성시 오류가 발생할 수 있습니다.`;
                addGenerationLog(warningMsg, 'warning');
                
                // 2.0 모델 선택시 추가 경고
                if (modelValue === 'gemini-2.0-flash-exp') {
                    const recommendMsg = `💡 대량 생성을 위해서는 Gemini 2.5 Flash (분당 100개) 사용을 권장합니다.`;
                    addGenerationLog(recommendMsg, 'info');
                    
                    // 동시 생성 개수 자동 조정 제안
                    if (userConcurrentLimit > 5) {
                        if (confirm(`Gemini 2.0 모델은 할당량이 적습니다 (분당 10개).\n동시 생성 개수를 5개로 줄이시겠습니까?`)) {
                            userConcurrentLimit = 5;
                            if (concurrentCountInput) {
                                concurrentCountInput.value = '5';
                            }
                        }
                    }
                }
            }
            
            console.log(`AI 모델 변경: ${config.name} (분당 ${config.quotaPerMinute}개)`);
            addGenerationLog(`AI 모델 변경: ${config.name}`, 'info');
        }
    };
    
    // 다중 생성 탭 모델 선택
    if (aiModelSelect) {
        aiModelSelect.addEventListener('change', (e) => {
            const value = (e.target as HTMLSelectElement).value;
            handleModelChange(value);
            // 단일 생성 탭 모델도 동기화
            if (aiModelSingleSelect) {
                aiModelSingleSelect.value = value;
            }
        });
    }
    
    // 단일 생성 탭 모델 선택
    if (aiModelSingleSelect) {
        aiModelSingleSelect.addEventListener('change', (e) => {
            const value = (e.target as HTMLSelectElement).value;
            handleModelChange(value);
            // 다중 생성 탭 모델도 동기화
            if (aiModelSelect) {
                aiModelSelect.value = value;
            }
        });
        
        // 초기값 설정
        selectedModel = aiModelSingleSelect.value || 'gemini-2.5-flash';  // 기본값 2.5
    }
    
    // 동시 생성 개수 입력 이벤트
    if (concurrentCountInput) {
        concurrentCountInput.addEventListener('input', (e) => {
            let value = parseInt((e.target as HTMLInputElement).value);
            
            // 범위 제한
            if (isNaN(value)) value = 10;
            if (value < 1) value = 1;
            if (value > 30) value = 30;
            
            userConcurrentLimit = value;
            (e.target as HTMLInputElement).value = value.toString();
            
            // 모든 프리셋 버튼의 active 클래스 제거
            document.querySelectorAll('.preset-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            console.log(`동시 생성 개수 변경: ${userConcurrentLimit}개`);
        });
        
        // 초기값 설정
        userConcurrentLimit = parseInt(concurrentCountInput.value) || 10;
    }
    
    // 프리셋 버튼들 이벤트
    const presetBtns = [
        { id: 'concurrent-preset-5', value: 5 },
        { id: 'concurrent-preset-10', value: 10 },
        { id: 'concurrent-preset-20', value: 20 },
        { id: 'concurrent-preset-30', value: 30 }
    ];
    
    presetBtns.forEach(({ id, value }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                userConcurrentLimit = value;
                if (concurrentCountInput) {
                    concurrentCountInput.value = value.toString();
                }
                
                // 모든 버튼의 active 클래스 제거 후 현재 버튼에만 추가
                document.querySelectorAll('.preset-btn').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                
                console.log(`동시 생성 개수 프리셋: ${value}개`);
            });
            
            // 초기 active 상태 설정
            if (value === 10) {
                btn.classList.add('active');
            }
        }
    });
    
    // Section Navigator
    const sectionNavButtons = document.querySelectorAll('.section-nav-btn');
    sectionNavButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            if (targetId) {
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });
    
    // Add click event to each tab button
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const targetTab = this.getAttribute('data-tab');
                console.log('Tab clicked:', targetTab); // Debug log
                
                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Show the corresponding tab content
                const targetContent = document.getElementById(`${targetTab}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                // Update widget based on current tab
                updateWidgetFromCurrentTab();
                
                // Handle navigation visibility and regenerate button
                if (keywordNavigation) {
                    if (targetTab === 'single') {
                        keywordNavigation.classList.add('hidden');
                        // Reset multiple content data when switching to single
                        multipleContentData = [];
                        currentKeywordIndex = 0;
                        // Clear custom prompt input
                        if (customImagePromptInput) {
                            customImagePromptInput.value = '';
                        }
                        currentPageCustomPrompt = '';
                        // Hide regenerate button in single mode (unless there's content)
                        if (regenerateButton) {
                            if (!resultContainer.innerText) {
                                regenerateButton.classList.add('hidden');
                            }
                        }
                    } else if (targetTab === 'multiple') {
                        // Show regenerate button if there's multiple content
                        if (regenerateButton && multipleContentData.length > 0 && multipleContentData[currentKeywordIndex]?.content) {
                            regenerateButton.classList.remove('hidden');
                        }
                    }
                }
                
                // Update download button text
                if (typeof updateDownloadButtonText === 'function') {
                    updateDownloadButtonText();
                }
            });
        });
    }
    
    // Excel upload button
    if (excelUploadBtn && excelFileInput) {
        excelUploadBtn.addEventListener('click', () => {
            excelFileInput.click();
        });
        
        excelFileInput.addEventListener('change', async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file && fileNameDisplay) {
                fileNameDisplay.textContent = file.name;
                fileNameDisplay.classList.add('has-file');
                
                if (generateMultipleBtn) {
                    generateMultipleBtn.disabled = false;
                }
                
                await parseExcelFile(file);
            }
        });
    }
    
    // Download template button
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', () => {
            const templateData = [
                ['키워드', '인기주제'],
                ['강아지 훈련', '말티즈 특징'],
                ['고양이 키우기', '러시안블루 성격'],
                ['반려동물 용품', '강아지 장난감 추천']
            ];
            
            if (!(window as any).XLSX) {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                document.head.appendChild(script);
                script.onload = () => createAndDownloadExcel(templateData);
            } else {
                createAndDownloadExcel(templateData);
            }
        });
    }
    
    // Multiple generation button with improved concurrent processing
    if (generateMultipleBtn) {
        generateMultipleBtn.addEventListener('click', async () => {
            if (multipleContentData.length === 0) {
                alert('엑셀 파일을 먼저 업로드해주세요.');
                return;
            }
            
            generateMultipleBtn.disabled = true;
            
            // 로딩 인디케이터 생성 및 표시
            const loadingDiv = createLoadingIndicator();
            loadingDiv.classList.remove('hidden');
            
            // 이전 로그 실제 삭제
            const logsContainer = document.getElementById('generation-logs');
            if (logsContainer) {
                logsContainer.innerHTML = '';
                logsContainer.style.display = 'block';
            }
            
            // 스피너 표시 및 메시지 초기화
            const spinner = document.querySelector('.loading-spinner') as HTMLElement;
            if (spinner) {
                spinner.style.display = 'block';
                spinner.style.animation = 'spin 1s linear infinite';
            }
            const message = document.querySelector('#loading p') as HTMLParagraphElement;
            if (message) {
                message.textContent = 'AI가 원고를 작성하고 있습니다... 잠시만 기다려주세요.';
                message.style.color = '#333';
                message.style.fontWeight = 'normal';
            }
            
            // Concurrent processing with queue management
            const CONCURRENT_LIMIT = userConcurrentLimit; // 사용자가 설정한 동시 생성 개수 사용
            
            const msg = `총 ${multipleContentData.length}개 항목 처리 시작 (동시 생성: ${CONCURRENT_LIMIT}개)`;
            console.log(`===== 다중 생성 시작 =====`);
            console.log(msg);
            addGenerationLog(msg, 'info');
            
            if (keywordNavigation) {
                keywordNavigation.classList.remove('hidden');
            }
            
            if (keywordButtonsContainer) {
                keywordButtonsContainer.innerHTML = '';
                multipleContentData.forEach((item, index) => {
                    const button = document.createElement('button');
                    button.className = 'keyword-btn';
                    button.innerHTML = `${item.keyword} <span class="count">${index + 1}</span>`;
                    button.addEventListener('click', () => {
                        showKeywordContent(index);
                    });
                    keywordButtonsContainer.appendChild(button);
                });
            }
            
            // Queue management variables
            let activeCount = 0;
            let currentIndex = 0;
            const totalItems = multipleContentData.length;
            let completedCount = 0;
            const processingItems = new Set(); // Track items being processed
            
            const processNextItem = async () => {
                if (currentIndex >= totalItems) return;
                
                const index = currentIndex++;
                
                // Prevent duplicate processing
                if (processingItems.has(index)) {
                    console.warn(`Item ${index} already being processed, skipping`);
                    return;
                }
                
                processingItems.add(index);
                const item = multipleContentData[index];
                const navButton = keywordButtonsContainer?.children[index] as HTMLElement;
                
                activeCount++;
                
                if (navButton) {
                    navButton.classList.add('processing');
                    navButton.style.backgroundColor = '#FCD34D';
                    navButton.style.color = '#000';
                }
                
                generateMultipleBtn.innerHTML = `<span>생성 중... (완료: ${completedCount}/${totalItems}, 진행: ${activeCount})</span>`;
                
                try {
                    // Generate content
                    const msg1 = `처리 시작: ${item.keyword}`;
                    console.log(`[처리 시작] #${index + 1} - ${item.keyword}`);
                    addGenerationLog(msg1, 'info');
                    
                    const content = await generateContentWithRetry(
                        item.keyword, 
                        item.topic, 
                        10,
                        index  // 인덱스 전달
                    );
                    multipleContentData[index].content = content;
                    
                    // Generate images
                    console.log(`[이미지 검색] #${index + 1} - ${item.keyword}`);
                    const images = await ensureTenImages(
                        item.keyword, 
                        item.topic
                    );
                    multipleContentData[index].images = images;
                    
                    if (navButton) {
                        navButton.classList.remove('processing');
                        navButton.style.backgroundColor = '#10B981';
                        navButton.style.color = 'white';
                    }
                    
                    completedCount++;
                    const msg2 = `완료 (${completedCount}/${totalItems}): ${item.keyword}`;
                    console.log(`[완료] #${index + 1} - ${item.keyword} (전체 진행: ${completedCount}/${totalItems})`);
                    addGenerationLog(msg2, 'success');
                    
                    // 현재 선택된 탭일 때만 내용 업데이트 (탭 자체는 변경하지 않음)
                    if (index === currentKeywordIndex) {
                        // 현재 보고 있는 탭의 내용만 업데이트
                        resultContainer.innerText = content;
                        updateCharCount();
                        displayImages(images);
                        // 위젯은 현재 탭 정보 유지
                        const retryCount = multipleContentData[index].retryCount || 0;
                        updateKeywordInfoWidget(item.keyword, item.topic, 'complete', retryCount);
                    }
                } catch (error) {
                    const msg = `실패: ${item.keyword}`;
                    console.error(`[실패] #${index + 1} - ${item.keyword}:`, error.message || error);
                    addGenerationLog(msg, 'error');
                    
                    multipleContentData[index].content = `[생성 실패] ${item.keyword}\n\n오류: ${error.message || '알 수 없는 오류'}`;
                    multipleContentData[index].images = [];
                    
                    // 현재 선택된 탭일 때만 내용 업데이트
                    if (index === currentKeywordIndex) {
                        resultContainer.innerText = multipleContentData[index].content;
                        updateCharCount();
                        imageGallery.innerHTML = '<p style="text-align: center; color: #666;">이미지 생성 실패</p>';
                        // 위젯은 현재 탭 정보 유지
                        updateKeywordInfoWidget(item.keyword, item.topic, 'error', 0);
                    }
                    
                    if (navButton) {
                        navButton.classList.remove('processing');
                        navButton.style.backgroundColor = '#EF4444';
                        navButton.style.color = 'white';
                    }
                    
                    completedCount++;
                    console.log(`[실패 처리 완료] #${index + 1} - ${item.keyword} (전체 진행: ${completedCount}/${totalItems})`);
                } finally {
                    activeCount--;
                    processingItems.delete(index); // Remove from processing set
                    
                    // Remove processing state
                    if (navButton) {
                        navButton.classList.remove('processing');
                    }
                    
                    // Update progress display
                    generateMultipleBtn.innerHTML = `<span>생성 중... (완료: ${completedCount}/${totalItems}, 진행: ${activeCount})</span>`;
                    
                    // Start next item if queue has space
                    if (currentIndex < totalItems && activeCount < CONCURRENT_LIMIT) {
                        // Reduced delay for faster processing
                        await new Promise(resolve => setTimeout(resolve, 50));
                        processNextItem();
                    }
                    
                    // Check if all items are complete
                    if (completedCount >= totalItems && activeCount === 0) {
                        const successCount = multipleContentData.filter(item => item.content && !item.content.startsWith('[생성 실패]')).length;
                        const failCount = multipleContentData.filter(item => item.content && item.content.startsWith('[생성 실패]')).length;
                        const finalMsg = `생성 완료: 성공 ${successCount}개, 실패 ${failCount}개`;
                        
                        console.log(`===== 다중 생성 완료 =====`);
                        console.log(`성공: ${successCount}개`);
                        console.log(`실패: ${failCount}개`);
                        console.log(`========================`);
                        
                        addGenerationLog(finalMsg, 'info');
                        
                        // 5초 후 로그 접기 (숨기지 않고)
                        setTimeout(() => {
                            const logsContainer = document.getElementById('generation-logs');
                            const toggleBtn = document.querySelector('#toggle-logs') as HTMLButtonElement;
                            const spinner = document.querySelector('.loading-spinner') as HTMLElement;
                            
                            if (logsContainer) {
                                logsContainer.style.display = 'none';
                            }
                            
                            if (toggleBtn) {
                                toggleBtn.innerHTML = '<span id="toggle-icon">▶</span> 로그 보기';
                            }
                            
                            // 스피너 숨기기
                            if (spinner) {
                                spinner.style.display = 'none';
                                spinner.style.animation = 'none';
                            }
                            
                            // 메시지 변경
                            const message = document.querySelector('#loading p') as HTMLParagraphElement;
                            if (message) {
                                message.textContent = `생성 완료! 성공: ${successCount}개, 실패: ${failCount}개`;
                                message.style.color = '#059669';
                                message.style.fontWeight = '600';
                            }
                        }, 5000);
                        
                        generateMultipleBtn.disabled = false;
                        generateMultipleBtn.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span class="button-text">다중 콘텐츠 생성하기</span>
                        `;
                        updateDownloadButtonText();
                    }
                }
            };
            
            // Start initial concurrent processes
            const initialProcesses = Math.min(userConcurrentLimit, totalItems); // 사용자 설정값으로 시작
            for (let i = 0; i < initialProcesses; i++) {
                // Stagger the starts to prevent overload
                await new Promise(resolve => setTimeout(resolve, 30 * i)); // 시작 간격 30ms
                processNextItem();
            }
        });
    }
    
    console.log('Tab initialization complete'); // Debug log
}, 100); // Small delay to ensure DOM is ready