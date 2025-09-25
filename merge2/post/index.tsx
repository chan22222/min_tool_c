
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from "@google/genai";
import type { Part } from "@google/genai";
import { Document, Packer, Paragraph, TextRun } from "docx";
import mammoth from "mammoth";


// --- DOM Element References ---
const form = document.getElementById('prompt-form') as HTMLFormElement;
const storeNameInput = document.getElementById('store-name') as HTMLInputElement;
const postTitleInput = document.getElementById('post-title') as HTMLInputElement;
const keywordsInput = document.getElementById('keywords') as HTMLInputElement;
const minCharsInput = document.getElementById('min-chars') as HTMLInputElement;
const maxCharsInput = document.getElementById('max-chars') as HTMLInputElement;
const storeInfoInput = document.getElementById('store-info') as HTMLTextAreaElement;
const orderedMenuUploadInput = document.getElementById('ordered-menu-upload') as HTMLInputElement;
const sampleUploadInput = document.getElementById('sample-upload') as HTMLInputElement;
const imageUploadInput = document.getElementById('image-upload') as HTMLInputElement;
const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const imagePreview = document.getElementById('image-preview') as HTMLDivElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const loadingIndicator = document.getElementById('loading') as HTMLDivElement;
const charCountElement = document.getElementById('char-count') as HTMLSpanElement;
const keywordCountElement = document.getElementById('keyword-count') as HTMLSpanElement;
const manuscriptGradeElement = document.getElementById('manuscript-grade') as HTMLSpanElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;
const exportButton = document.getElementById('export-button') as HTMLButtonElement;
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
const tabsContainer = document.getElementById('tabs-container') as HTMLDivElement;

// 3개의 결과 컨테이너
const resultContainers = {
    1: document.getElementById('result-1') as HTMLDivElement,
    2: document.getElementById('result-2') as HTMLDivElement,
    3: document.getElementById('result-3') as HTMLDivElement
};

// 현재 선택된 탭
let currentTab = 1;

let imageParts: Part[] = [];
let sampleContent: string = '';
let orderedMenuContent: string = '';


// --- Gemini API Initialization ---
// API 키 풀 관리 - 15개의 고정 API 키를 순환하며 사용
const API_KEYS = [
    'AIzaSyDXo7fyv6X0ERJOE1x-GWfdJAgSDpfSQ-4',
    'AIzaSyDBAPQ8AQZQedn_8X_Z2J7AqRnYeVJ3ij0',
    'AIzaSyDPuugJCUrFkzLuLjPKqhQOJVd-VNc_jtc',
    'AIzaSyAnY6_LcV-dC7ln5oCI73WYJlkUzagbgJw',
    'AIzaSyDwEd_mh5tQMzLCNrGh64UL7SQpY7Y9SzA',
    'AIzaSyAcsFagemLsJAeDjXQxs64XsU4Z9sPYPOw',
    'AIzaSyD8KWqJLnOWvYxhXyZAKwYvBl37Q3iCDF0',
    'AIzaSyBq_Q7NgOR6mJQ5IpxRzjfR3AH3SUT5zfg',
    'AIzaSyDOnYjs38Nw-CNQ-HU8XnHgcWO0cJyEWiA',
    'AIzaSyDoScCbXhuk-A15P0vRy13j3xFARVO7mrA',
    'AIzaSyCk5NfW1kKqjRci9bQPn1kzG2Wt1MJz_XY',
    'AIzaSyCSK6ynW9NXgbFGMAagmBnObHf61RroUI4',
    'AIzaSyBe2vLOg_DXAXNgeGp021-snXQelUknfEo',
    'AIzaSyArpJ5fpPNDSEmX9bJZSPIL7Ewp7xZU9AY',
    'AIzaSyCuBIyDkGG8-qkjFNDMOLpyxVjdqT5IU4M'
];

// 랜덤하게 시작 키 선택
let currentKeyIndex = Math.floor(Math.random() * API_KEYS.length);
let API_KEY = API_KEYS[currentKeyIndex];
console.log(`초기 API 키 선택: ${currentKeyIndex + 1}번 API 사용`);

// AI 인스턴스를 담을 변수
let genAI = new GoogleGenAI({ apiKey: API_KEY });
let selectedModel = "gemini-2.5-flash"; // 기본 모델

// 다음 API 키로 전환하는 함수
function switchToNextAPIKey() {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    API_KEY = API_KEYS[currentKeyIndex];
    genAI = new GoogleGenAI({ apiKey: API_KEY });
    console.log(`API 키 전환: ${currentKeyIndex + 1}번 API 사용`);
}

// --- Helper Functions ---

/**
 * Converts a File object to a GoogleGenAI.Part object.
 */
async function fileToGenerativePart(file: File): Promise<Part> {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: {
            data: await base64EncodedDataPromise,
            mimeType: file.type,
        },
    };
}

/**
 * 탭 전환 함수
 */
function switchTab(tabNumber: number) {
    // 현재 탭 숨기기
    resultContainers[currentTab].style.display = 'none';
    document.querySelector(`.tab-button[data-tab="${currentTab}"]`)?.classList.remove('active');
    
    // 새 탭 보이기
    currentTab = tabNumber;
    resultContainers[currentTab].style.display = 'block';
    document.querySelector(`.tab-button[data-tab="${currentTab}"]`)?.classList.add('active');
    
    // 글자 수 업데이트
    updateCharCount();
}

/**
 * Counts Korean characters in a string, excluding whitespace.
 */
function countKoreanChars(text: string): number {
    const koreanChars = text.match(/[\uAC00-\uD7A3]/g);
    return koreanChars ? koreanChars.length : 0;
}

/**
 * Counts keyword occurrences in text.
 */
function countKeywords(text: string): { [key: string]: number } {
    const keywordsValue = keywordsInput.value.trim();
    if (!keywordsValue) return {};
    
    // Split keywords by comma and clean them
    const keywords = keywordsValue.split(',').map(k => {
        // Remove numbers from keywords (e.g., '진해고기맛집2' -> '진해고기맛집')
        return k.trim().replace(/\d+/g, '');
    }).filter(k => k.length > 0);
    
    const counts: { [key: string]: number } = {};
    const lowerText = text.toLowerCase();
    
    keywords.forEach(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        // Count occurrences using regex for accurate word boundaries
        const regex = new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = text.match(regex);
        counts[keyword] = matches ? matches.length : 0;
    });
    
    return counts;
}

/**
 * 원고 등급 계산 함수
 */
function calculateManuscriptGrade(text: string, tabIndex?: number): { grade: string, points: number, details: string[] } {
    let points = 0;
    const details: string[] = [];
    
    // 한글 글자 수 계산
    const koreanCount = countKoreanChars(text);
    
    // 키워드 횟수 계산
    const keywordCounts = countKeywords(text);
    const totalKeywordCount = Object.values(keywordCounts).reduce((sum, count) => sum + count, 0);
    const adjustedKeywordCount = Math.max(0, totalKeywordCount - 5);
    
    // 1. "인용구로 3개 문장 묶어서" 정확히 체크
    if (text.includes('인용구로 3개 문장 묶어서')) {
        points++;
        details.push('인용구 3개 문장');
    }
    
    // 2. "소제목은 모두 인용구 사용" 정확히 체크
    if (text.includes('소제목은 모두 인용구 사용')) {
        points++;
        details.push('소제목 인용구');
    }
    
    // 3. "제목 : " 정확히 체크 (콜론 포함)
    if (text.includes('제목 : ') || text.includes('제목: ')) {
        points++;
        details.push('제목 형식');
    }
    
    // 4. "주문한 메뉴 전체 인용구" 정확히 체크
    if (text.includes('주문한 메뉴 전체 인용구')) {
        points++;
        details.push('메뉴 전체 인용구');
    }
    
    // 5. "플레이스 지도" 체크
    if (text.includes('플레이스 지도')) {
        points++;
        details.push('플레이스 지도');
    }
    
    // 6. 한글 1800자 이상
    if (koreanCount >= 1800) {
        points++;
        details.push(`글자수 충족(${koreanCount}자)`);
    }
    
    // 7. 키워드 5회 이상
    if (adjustedKeywordCount >= 5) {
        points++;
        details.push(`키워드 충족(${adjustedKeywordCount}회)`);
    }
    
    // 8. "파일 리스트"가 없는 경우
    if (!text.includes('파일 리스트')) {
        points++;
        details.push('파일리스트 없음');
    }
    
    // 감점 항목 추가
    // 글자수 1700자 이하이면 -2점
    if (koreanCount <= 1700) {
        points -= 2;
        details.push(`글자수 부족(-2점, ${koreanCount}자)`);
    }
    
    // 키워드 4회 이하면 -2점
    if (adjustedKeywordCount <= 4) {
        points -= 2;
        details.push(`키워드 부족(-2점, ${adjustedKeywordCount}회)`);
    }
    
    // 점수가 음수가 되지 않도록 보정
    points = Math.max(0, points);
    
    // 등급 결정
    let grade = 'F';
    if (points >= 8) grade = 'S';
    else if (points === 7) grade = 'A';
    else if (points === 6) grade = 'B';
    else if (points === 5) grade = 'C';
    else if (points === 4) grade = 'D';
    else grade = 'F';
    
    const logTabIndex = tabIndex !== undefined ? tabIndex : currentTab;
    console.log(`원고 ${logTabIndex} 등급 계산: ${grade}급 (${points}점) - ${details.join(', ')}`);
    
    return { grade, points, details };
}

/**
 * Updates the character count and keyword count display for current tab.
 */
function updateCharCount() {
    const resultContainer = resultContainers[currentTab];
    const text = resultContainer.innerText || '';
    // Just count the text as-is without removing any markers
    const count = countKoreanChars(text);
    charCountElement.textContent = `한글(공백제외): ${count} [원고 ${currentTab}]`;
    
    // Update keyword count
    const keywordCounts = countKeywords(text);
    const totalKeywordCount = Object.values(keywordCounts).reduce((sum, count) => sum + count, 0);
    
    // Subtract 5 from total to account for keywords in title (제목에 포함된 키워드 제외)
    const adjustedTotalCount = Math.max(0, totalKeywordCount - 5);
    
    // Create detailed keyword count display
    if (Object.keys(keywordCounts).length > 0) {
        const details = Object.entries(keywordCounts)
            .map(([keyword, count]) => `${keyword}(${count})`)
            .join(', ');
        keywordCountElement.textContent = `키워드: ${adjustedTotalCount}회 [${details}]`;
        keywordCountElement.style.color = adjustedTotalCount >= 5 ? '#4CAF50' : '#ff6600';
    } else {
        keywordCountElement.textContent = '키워드: 0회';
        keywordCountElement.style.color = '#ff6600';
    }
    
    // 등급 계산 및 표시
    if (text.length > 0) {
        const { grade, points, details } = calculateManuscriptGrade(text);
        manuscriptGradeElement.textContent = `등급: ${grade}급 (${points}점)`;
        manuscriptGradeElement.className = `grade-${grade.toLowerCase()}`;
        manuscriptGradeElement.title = `획득 항목: ${details.join(', ')}`;
    } else {
        manuscriptGradeElement.textContent = '등급: -';
        manuscriptGradeElement.className = '';
    }
    
    // Enable/disable copy and export buttons based on whether there's content
    const hasContent = count > 0;
    copyButton.disabled = !hasContent;
    exportButton.disabled = !hasContent;
}

// --- Event Handlers ---

/**
 * Handles image file selection, conversion, and preview.
 */
async function handleImageFiles(files: FileList) {
    imagePreview.innerHTML = '';
    imageParts = [];

    const filePromises = Array.from(files).slice(0, 20).map(async (file) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                const imageDataUrl = e.target?.result as string;
                img.src = imageDataUrl;
                img.alt = file.name;
                img.className = 'thumbnail';
                img.style.cursor = 'pointer';
                img.onclick = () => {
                    const newWindow = window.open('', '_blank', 'width=700,height=900,scrollbars=yes,resizable=yes');
                    if (newWindow) {
                        newWindow.document.write(`
                            <html>
                            <head><title>${file.name}</title></head>
                            <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                                <img src="${imageDataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;">
                            </body>
                            </html>
                        `);
                        newWindow.document.close();
                    }
                };
                imagePreview.appendChild(img);
            };
            reader.readAsDataURL(file);
            return fileToGenerativePart(file);
        }
        return null;
    });

    const parts = await Promise.all(filePromises);
    imageParts = parts.filter((part): part is Part => part !== null);
}

/**
 * Handles sample manuscript .docx file selection.
 */
async function handleSampleFile(file: File | null, isDefault: boolean = false) {
    // 기본 샘플 로드 표시 제거
    const sampleLabel = document.querySelector('label[for="sample-upload"]');
    if (sampleLabel) {
        sampleLabel.innerHTML = '샘플 원고 (.docx, 선택 사항)';
    }
    
    if (!file) {
        sampleContent = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const result = await mammoth.extractRawText({ arrayBuffer });
            sampleContent = result.value;
            
            // 기본 샘플인 경우 표시
            if (isDefault && sampleLabel) {
                sampleLabel.innerHTML = '샘플 원고 (.docx, 선택 사항) <span style="color: green;">✓ 기본 샘플 로드됨</span>';
            }
        } catch (error) {
            console.error("Error parsing .docx file:", error);
            alert("DOCX 파일 분석에 실패했습니다. 파일이 손상되지 않았는지 확인해주세요.");
            sampleContent = '';
            sampleUploadInput.value = ''; // Clear the input
        }
    };
    reader.onerror = () => {
        console.error("Error reading file.");
        alert("파일을 읽는 중 오류가 발생했습니다.");
        sampleContent = '';
        sampleUploadInput.value = ''; // Clear the input
    };
    reader.readAsArrayBuffer(file);
}


/**
 * Handles ordered menu file selection.
 */
function handleMenuFile(file: File | null) {
    if (!file) {
        orderedMenuContent = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        orderedMenuContent = e.target?.result as string;
    };
    reader.readAsText(file);
}

/**
 * Exports the content of the current tab to a .docx file.
 */
async function exportToWord() {
    const content = resultContainers[currentTab].innerText;
    if (!content) return;

    // Process content without any markers
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

    try {
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${postTitleInput.value.trim() || 'blog-post'}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to export to Word:", error);
        alert("문서 생성에 실패했습니다. 콘솔을 확인해주세요.");
    }
}


/**
 * 단일 원고 생성 함수
 */
async function generateSinglePost(index: number, masterPrompt: string, usedKeys: Set<number>): Promise<void> {
    const progressElement = document.getElementById(`progress-${index}`);
    
    // 사용되지 않은 API 키 중에서 랜덤 선택
    const availableKeys = API_KEYS.map((_, i) => i).filter(i => !usedKeys.has(i));
    let keyIndex: number;
    
    if (availableKeys.length > 0) {
        keyIndex = availableKeys[Math.floor(Math.random() * availableKeys.length)];
    } else {
        // 모든 키가 사용 중이면 랜덤 선택
        keyIndex = Math.floor(Math.random() * API_KEYS.length);
    }
    
    usedKeys.add(keyIndex);
    const apiKey = API_KEYS[keyIndex];
    const genAI = new GoogleGenAI({ apiKey: apiKey });
    
    if (progressElement) progressElement.textContent = `${keyIndex + 1}번 API 사용 중...`;
    console.log(`원고 ${index}: ${keyIndex + 1}번 API 사용`);
    
    // 재시도 로직
    const maxRetries = 5;
    let retryCount = 0;
    let success = false;
    let lastUsedKey = keyIndex;
    
    while (retryCount < maxRetries && !success) {
        try {
            // API 키가 바뀌었으면 새 인스턴스 생성
            const currentGenAI = retryCount > 0 
                ? new GoogleGenAI({ apiKey: API_KEYS[lastUsedKey] })
                : genAI;
                
            const contents = {
                parts: [{ text: masterPrompt }, ...imageParts],
            };
            
            const responseStream = await currentGenAI.models.generateContentStream({
                model: selectedModel,
                contents: contents,
            });

            let fullText = '';
            for await (const chunk of responseStream) {
                fullText += chunk.text;
                const processedText = fullText.replace(/\n/g, '<br>');
                resultContainers[index].innerHTML = processedText;
            }
            
            success = true;
            if (progressElement) {
                // 해당 원고의 등급 계산 (인덱스 전달)
                const text = resultContainers[index].innerText || '';
                const { grade, points } = calculateManuscriptGrade(text, index);
                progressElement.innerHTML = `✅ 완료 <span class="grade-${grade.toLowerCase()}" style="padding: 2px 8px; border-radius: 12px; margin-left: 8px; font-size: 12px;">${grade}급(${points}점)</span>`;
            }
            console.log(`원고 ${index} 생성 성공`);
            
            // 현재 탭이면 UI 업데이트
            if (index === currentTab) {
                updateCharCount();
            }
            
        } catch (error: any) {
            retryCount++;
            console.error(`원고 ${index} 시도 ${retryCount} 실패 (API ${lastUsedKey + 1}):`, error);
            
            if (retryCount < maxRetries) {
                // 재시도 시 다른 랜덤 API 키 선택 (이전 키 제외)
                const availableRetryKeys = API_KEYS.map((_, i) => i).filter(i => i !== lastUsedKey);
                const newKeyIndex = availableRetryKeys[Math.floor(Math.random() * availableRetryKeys.length)];
                lastUsedKey = newKeyIndex;
                
                const newApiKey = API_KEYS[newKeyIndex];
                genAI.apiKey = newApiKey;
                
                if (progressElement) progressElement.textContent = `재시도 중... (${newKeyIndex + 1}번 API)`;
                console.log(`원고 ${index}: 재시도 ${retryCount}/${maxRetries} - ${newKeyIndex + 1}번 API로 전환`);
                
                // 재시도 전 대기
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
            } else {
                if (progressElement) progressElement.textContent = '❌ 실패';
                resultContainers[index].innerHTML = `<span style="color: red;">원고 ${index} 생성 실패 (${maxRetries}회 시도)</span>`;
                console.error(`원고 ${index}: 모든 재시도 실패`);
            }
        }
    }
}

/**
 * Main function to generate the blog post.
 */
async function generateBlogPost() {
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    generateButton.disabled = true;
    loadingIndicator.classList.remove('hidden');
    tabsContainer.classList.remove('hidden');
    
    // 모든 결과 컨테이너 초기화
    Object.values(resultContainers).forEach(container => {
        container.textContent = '';
    });
    updateCharCount();

    const storeName = storeNameInput.value;
    const postTitle = postTitleInput.value;
    const keywords = keywordsInput.value;
    const storeInfo = storeInfoInput.value;
    const minChars = minCharsInput.value;
    const maxChars = maxCharsInput.value;


    const basePrompt = `
You are an expert Naver blog post writer. Your goal is to write a blog post that will attract customers to a store.

**User-provided Details:**
- Blog Post Title: ${postTitle}
- Keywords: ${keywords}
- Store Name: ${storeName}
- Key Store Info: ${storeInfo || 'Not provided. Write based on the store name and general knowledge.'}
- Ordered Menu for Review: ${orderedMenuContent || 'Not provided. Assume popular menu items.'}

**Mandatory Writing Rules:**
1.  **Length**: Write between ${minChars} and ${maxChars} Korean characters (excluding spaces). This is a strict requirement.
2.  **Keywords**: Naturally include the main keyword(s) at least 7 times in the post.
3.  **Title**: The blog post title must be included within the first 100 characters of the body.
4.  **Formatting**: Use a newline after every single sentence.
5.  **Tone**: Write in a casual, friendly tone. Avoid stiff, AI-like language.
6.  **No Specifics**: To avoid errors, do not mention specific prices or the exact street address. General location based on user info is fine.
7.  **Keyword Numbers**: Ignore any numbers in the keywords (e.g., if a keyword is '진해고기맛집2', use '진해고기맛집').
8.  **Plain Text**: Do not use any markdown or special formatting characters like asterisks (\`**\`). The output must be plain text.

**Section Structure:**
- **Introduction**: Describe the reason for visiting, first impressions, and feelings of anticipation.
- **1. Store Information**: Detail information like general location, transportation, business hours, parking, and reservation methods, based on user-provided info. (Do not associate photos with this section).
- **2. Interior & Exterior**: Describe the building's exterior, interior design, atmosphere, seating, music, and lighting in detail. (Use interior and exterior photos here).
- **3. Menu Introduction**: Explain the menu, signature dishes, and general price range. (Use menu photos here).
- **4. Food Review**: Give a detailed review of the food specified in "Ordered Menu for Review," describing its appearance, taste, texture, temperature, portion size, and plating. (Use food photos here).
- **Conclusion**: Provide an overall evaluation, recommend key points, state your intention to revisit, and offer helpful tips for future visitors. (Use a composite/summary photo here).

**Flavor Expressions:**
To ensure Naver's AI recognizes this as a high-quality "맛집" (tasty restaurant) post, use a rich variety of taste descriptions:
-   **Basic**: sweet, salty, spicy, sour, bitter, savory (감칠맛)
-   **Texture**: crispy, chewy, soft, moist, nutty, light/plain (담백한)
-   **Temperature**: hot, cool, cold, lukewarm
-   **Complex**: nutty yet light, sweet & spicy, sweet & sour

**Image Placement & Formatting:**
-   Place image markers and their descriptions following this exact format:
    [이미지 1-카테고리]
    A short, descriptive caption for the image goes here.

    [이미지 2-카테고리]
    Another short, descriptive caption for the image goes here.
-   Replace '카테고리' with a relevant category (e.g., 외부, 내부, 메뉴판, 음식).
-   Each image marker and its description must be separated by a single newline.
-   There MUST be exactly one blank line between each [image + description] block.
-   Provide a unique caption for every single image.
-   Use all 20 provided images if available.

**IMPORTANT:**
After writing, you must ensure the post is between ${minChars} and ${maxChars} Korean characters (excluding spaces). Now, write the blog post.
`;
    
    const sampleBasedPrompt = `
You are an expert Naver blog post writer. A user has provided a sample manuscript to use as a template.
Your task is to modify ONLY specific parts while keeping the overall format and structure intact.

**User-provided Details:**
- Blog Post Title: ${postTitle}
- Keywords: ${keywords}
- Store Name: ${storeName}
- Key Store Info: ${storeInfo}
- Ordered Menu for Review: ${orderedMenuContent}

**User-provided Sample Manuscript / Template:**
---
${sampleContent}
---

**CRITICAL INSTRUCTION: PRESERVE THE SAMPLE FORMAT**
You must maintain the internal format and structure of the sample manuscript as much as possible.
ONLY modify the following elements:

**Parts to CHANGE:**
1. **Title**: Replace with ${postTitle}
2. **Title Repetition**: If the title is repeated 3 times in the sample, replace all 3 instances with ${postTitle}
3. **Keywords**: Replace existing keywords with ${keywords}
4. **Store Information**: Replace store details with ${storeName} and ${storeInfo}
5. **Hashtags**: Update hashtags to match the new store and keywords
6. **Image Names/Descriptions**: Update [이미지 X-카테고리] markers and their captions to match the new content
7. **Ordered Menu**: Replace menu items with ${orderedMenuContent}
8. **Introduction**: Rewrite the opening paragraph to match the new store
9. **Conclusion**: Rewrite the closing paragraph to match the new store

**Parts to KEEP UNCHANGED:**
- Overall document structure and formatting
- Section divisions and organization
- Writing style and tone
- Sentence patterns and flow
- Paragraph lengths and arrangements
- Any special formatting or spacing patterns from the original
- The way information is presented

**OUTPUT REQUIREMENT:**
Do NOT use any special markers in the output text.
Simply write the modified content naturally, replacing the necessary parts while maintaining the original format and structure.

**Mandatory Rules:**
1. **Final Length**: Must be between ${minChars} and ${maxChars} Korean characters (excluding spaces).
2. **Keywords**: Include main keyword(s) at least 5 times naturally.
3. **Title**: Include blog post title within the first 100 characters.
4. **Formatting**: Keep every single sentence ending with a newline.
5. **Plain Text**: No markdown or special formatting characters.
6. **Image Format**: Maintain exact image marker format from sample with one blank line between blocks.

IMPORTANT: The goal is to make it look like the same writer wrote about a different store, keeping their unique style and format intact.
`;

    const masterPrompt = sampleContent ? sampleBasedPrompt : basePrompt;

    // 사용된 API 키 추적을 위한 Set
    const usedKeys = new Set<number>();
    
    // 3개 원고 동시 생성
    const promises = [1, 2, 3].map(index => generateSinglePost(index, masterPrompt, usedKeys));
    
    try {
        await Promise.all(promises);
        console.log('모든 원고 생성 완료');
    } catch (error) {
        console.error('원고 생성 중 오류 발생:', error);
    }

    generateButton.disabled = false;
    loadingIndicator.classList.add('hidden');
    updateCharCount(); // Final check
}

// --- Event Listeners Setup ---

form.addEventListener('submit', (e) => {
    e.preventDefault();
    generateBlogPost();
});

// 모델 선택 이벤트 리스너
if (modelSelect) {
    modelSelect.addEventListener('change', () => {
        selectedModel = modelSelect.value;
        console.log('선택된 모델:', selectedModel);
    });
}

sampleUploadInput.addEventListener('change', () => {
    // 사용자가 파일을 선택하면 기본 샘플이 아님을 표시
    handleSampleFile(sampleUploadInput.files ? sampleUploadInput.files[0] : null, false);
});

orderedMenuUploadInput.addEventListener('change', () => {
    handleMenuFile(orderedMenuUploadInput.files ? orderedMenuUploadInput.files[0] : null);
});

imageUploadInput.addEventListener('change', () => {
    if (imageUploadInput.files) {
        handleImageFiles(imageUploadInput.files);
    }
});

dropZone.addEventListener('click', () => imageUploadInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer?.files) {
        imageUploadInput.files = e.dataTransfer.files;
        handleImageFiles(e.dataTransfer.files);
    }
});

// 각 결과 컨테이너에 input 이벤트 리스너 추가
Object.values(resultContainers).forEach(container => {
    container.addEventListener('input', updateCharCount);
});

// Update keyword count when keywords are changed
keywordsInput.addEventListener('input', updateCharCount);

// 탭 버튼 이벤트 리스너 추가
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
        const tabNumber = parseInt((e.target as HTMLElement).dataset.tab!);
        switchTab(tabNumber);
    });
});

copyButton.addEventListener('click', () => {
    const currentContent = resultContainers[currentTab].innerText;
    if (currentContent) {
        // Copy text as-is
        navigator.clipboard.writeText(currentContent)
            .then(() => {
                const originalText = copyButton.querySelector('span')!.textContent;
                copyButton.querySelector('span')!.textContent = `복사됨! [원고 ${currentTab}]`;
                setTimeout(() => {
                    copyButton.querySelector('span')!.textContent = originalText;
                }, 2000);
            })
            .catch(err => console.error('Failed to copy text: ', err));
    }
});

exportButton.addEventListener('click', exportToWord);

// 메뉴와 이미지 불러오기 버튼 이벤트 리스너
const loadMenuImagesButton = document.getElementById('load-menu-images') as HTMLButtonElement;
if (loadMenuImagesButton) {
    loadMenuImagesButton.addEventListener('click', async () => {
        // 현재 샘플 원고 상태 확인
        const sampleLabel = document.querySelector('label[for="sample-upload"]');
        const hasDefaultSample = sampleLabel && sampleLabel.innerHTML.includes('✓ 기본 샘플 로드됨');
        
        // 기본 샘플이 로드되어 있거나, 샘플이 없을 때 새로운 샘플 로드
        if (!sampleContent || hasDefaultSample) {
            try {
                // post_sample 폴더의 metadata.json에서 파일 목록 가져오기
                const metaResponse = await fetch('./post_sample/metadata.json');
                
                if (metaResponse.ok) {
                    const metadata = await metaResponse.json();
                    const docxFiles = metadata.files || [];
                    
                    if (docxFiles.length > 0) {
                        // 현재 로드된 파일 확인
                        let currentFile = '';
                        if (hasDefaultSample && sampleLabel) {
                            const match = sampleLabel.innerHTML.match(/✓ 기본 샘플 로드됨 \((.*?)\)/);
                            currentFile = match ? match[1] : '';
                        }
                        
                        // 다른 파일 선택 (현재 파일 제외)
                        let availableFiles = docxFiles;
                        if (currentFile && docxFiles.length > 1) {
                            availableFiles = docxFiles.filter((f: string) => f !== currentFile);
                        }
                        
                        const randomIndex = Math.floor(Math.random() * availableFiles.length);
                        const selectedFile = availableFiles[randomIndex];
                        
                        // 선택된 파일 로드
                        const fileResponse = await fetch(`./post_sample/${selectedFile}`);
                        if (fileResponse.ok) {
                            const blob = await fileResponse.blob();
                            const file = new File([blob], selectedFile, { 
                                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
                            });
                            
                            // 샘플 로드 및 파일명 표시
                            const reader = new FileReader();
                            reader.onload = async (e) => {
                                try {
                                    const arrayBuffer = e.target?.result as ArrayBuffer;
                                    const result = await mammoth.extractRawText({ arrayBuffer });
                                    sampleContent = result.value;
                                    
                                    // 기본 샘플 표시 업데이트 (파일명 포함)
                                    if (sampleLabel) {
                                        sampleLabel.innerHTML = `샘플 원고 (.docx, 선택 사항) <span style="color: green;">✓ 기본 샘플 로드됨 (${selectedFile})</span>`;
                                    }
                                    console.log(`랜덤 샘플 파일(${selectedFile})이 자동으로 로드되었습니다.`);
                                } catch (error) {
                                    console.error("Error parsing .docx file:", error);
                                }
                            };
                            reader.readAsArrayBuffer(file);
                        } else {
                            console.log(`샘플 파일을 찾을 수 없습니다: ${selectedFile}`);
                        }
                    } else {
                        console.log('metadata.json에 파일 목록이 없습니다.');
                    }
                } else {
                    // metadata.json이 없으면 기본 파일 사용
                    console.log('metadata.json을 찾을 수 없어 기본 샘플을 사용합니다.');
                    const response = await fetch('./default_sample.docx');
                    if (response.ok) {
                        const blob = await response.blob();
                        const file = new File([blob], 'default_sample.docx', { 
                            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
                        });
                        await handleSampleFile(file, true);
                    }
                }
            } catch (error) {
                console.log('샘플 파일 로드 중 오류:', error);
            }
        } else if (sampleUploadInput.files?.length) {
            // 사용자가 직접 업로드한 파일이 있는 경우
            console.log('사용자가 업로드한 샘플 원고가 이미 있습니다.');
        }
        
        if (isInIframe) {
            // 부모 창에 메뉴와 이미지 요청
            window.parent.postMessage({ type: 'REQUEST_MENU_IMAGES' }, '*');
        } else {
            alert('이 기능은 메인 페이지에서만 사용 가능합니다.');
        }
    });
}

// === 부모 창과의 통신 설정 ===
// iframe 내에서 실행 중인지 확인
const isInIframe = window.parent !== window;

if (isInIframe) {
    console.log('iframe 모드에서 실행 중입니다.');
    
    // 부모 창으로부터 메시지 수신
    window.addEventListener('message', async (event) => {
        if (event.data.type === 'IMAGES_DATA') {
            // 부모 창에서 이미지 데이터 수신
            console.log(`${event.data.images.length}개의 이미지를 수신했습니다.`);
            
            // store-name과 store-info 자동 저장
            if (event.data.storeName) {
                (document.getElementById('store-name') as HTMLInputElement).value = event.data.storeName;
            }
            if (event.data.storeInfo) {
                (document.getElementById('store-info') as HTMLTextAreaElement).value = event.data.storeInfo;
            }
            
            // 이미지 미리보기 업데이트
            imagePreview.innerHTML = '';
            imageParts = [];
            
            for (const imageData of event.data.images) {
                // 미리보기 추가
                const img = document.createElement('img');
                img.src = imageData.data;
                img.alt = imageData.category;
                img.className = 'thumbnail';
                imagePreview.appendChild(img);
                
                // Gemini API용 Part 생성
                const base64Data = imageData.data.split(',')[1];
                imageParts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: 'image/jpeg'
                    }
                });
            }
        } else if (event.data.type === 'RESTORE_POST_DATA') {
            // 저장된 post 데이터 복원
            if (event.data.storeName) {
                (document.getElementById('store-name') as HTMLInputElement).value = event.data.storeName;
            }
            if (event.data.storeInfo) {
                (document.getElementById('store-info') as HTMLTextAreaElement).value = event.data.storeInfo;
            }
        } else if (event.data.type === 'REQUEST_POST_DATA') {
            // 현재 post 데이터 요청 (저장 시)
            const storeNameEl = document.getElementById('store-name') as HTMLInputElement;
            const storeInfoEl = document.getElementById('store-info') as HTMLTextAreaElement;
            
            window.parent.postMessage({
                type: 'POST_DATA_RESPONSE',
                storeName: storeNameEl ? storeNameEl.value : '',
                storeInfo: storeInfoEl ? storeInfoEl.value : ''
            }, '*');
        } else if (event.data.type === 'API_KEY') {
            // API 키 수신
            API_KEY = event.data.key;
            // iframe 컨텍스트에서 localStorage 접근 시 parent의 origin 사용
            try {
                window.parent.localStorage.setItem('gemini_api_key', API_KEY);
            } catch (e) {
                // iframe 보안 제한으로 실패시 현재 컨텍스트에 저장
                localStorage.setItem('gemini_api_key', API_KEY);
            }
        } else if (event.data.type === 'REQUEST_MANUSCRIPT_FOR_EXPORT') {
            // Export용 원고 요청 (텍스트) - 현재 선택된 탭
            window.parent.postMessage({
                type: 'MANUSCRIPT_EXPORT',
                content: resultContainers[currentTab].innerText || ''
            }, '*');
        } else if (event.data.type === 'REQUEST_MANUSCRIPT_DOCX_FOR_EXPORT') {
            // Export용 원고 요청 (DOCX) - 현재 선택된 탭
            const text = resultContainers[currentTab].innerText || '';
            if (text) {
                // docx 생성 - 이미 import된 것 사용
                
                const lines = text.split('\n');
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
                
                try {
                    const blob = await Packer.toBlob(doc);
                    // Blob을 ArrayBuffer로 변환하여 전송
                    const arrayBuffer = await blob.arrayBuffer();
                    window.parent.postMessage({
                        type: 'MANUSCRIPT_EXPORT_DOCX',
                        arrayBuffer: arrayBuffer,
                        mimeType: blob.type
                    }, '*');
                } catch (error) {
                    console.error("Failed to create docx:", error);
                    window.parent.postMessage({
                        type: 'MANUSCRIPT_EXPORT_DOCX',
                        arrayBuffer: null
                    }, '*');
                }
            } else {
                window.parent.postMessage({
                    type: 'MANUSCRIPT_EXPORT_DOCX',
                    arrayBuffer: null
                }, '*');
            }
        }
    });
    
    // 원고 생성/수정시 부모 창에 알림
    const originalGenerateBlogPost = generateBlogPost;
    generateBlogPost = async function() {
        await originalGenerateBlogPost();
        
        // 생성 완료 알림 - 현재 선택된 탭
        const text = resultContainers[currentTab].innerText || '';
        const koreanChars = text.match(/[\uAC00-\uD7A3]/g);
        const count = koreanChars ? koreanChars.length : 0;
        
        window.parent.postMessage({
            type: 'MANUSCRIPT_GENERATED',
            content: text,
            charCount: count
        }, '*');
    };
    
    // 원고 수정시 부모 창에 알림
    Object.values(resultContainers).forEach(container => {
        container.addEventListener('input', () => {
            if (isInIframe) {
                window.parent.postMessage({
                    type: 'MANUSCRIPT_UPDATED',
                    content: container.innerText || ''
                }, '*');
            }
        });
    });
    
    // 초기 이미지 요청
    setTimeout(() => {
        window.parent.postMessage({ type: 'REQUEST_IMAGES' }, '*');
    }, 1000);
}

// Initialize keyword count display on page load
document.addEventListener('DOMContentLoaded', () => {
    updateCharCount();
});