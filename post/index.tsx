
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
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
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
const resultContainer = document.getElementById('result') as HTMLDivElement;
const loadingIndicator = document.getElementById('loading') as HTMLDivElement;
const charCountElement = document.getElementById('char-count') as HTMLSpanElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;
const exportButton = document.getElementById('export-button') as HTMLButtonElement;

let imageParts: Part[] = [];
let imageFiles: File[] = [];  // 이미지 파일 배열 추가
let sampleContent: string = '';
let orderedMenuContent: string = '';


// --- Gemini API Initialization ---
// API 키 관리 (로컬 스토리지 사용)
let API_KEY = localStorage.getItem('gemini_api_key') || '';
if (API_KEY && apiKeyInput) {
    apiKeyInput.value = API_KEY;
}

// API 키 입력 필드 변경 시 저장
apiKeyInput?.addEventListener('change', () => {
    API_KEY = apiKeyInput.value;
    if (API_KEY) {
        localStorage.setItem('gemini_api_key', API_KEY);
    }
});

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = "gemini-2.5-flash";

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
 * Counts Korean characters in a string, excluding whitespace.
 */
function countKoreanChars(text: string): number {
    const koreanChars = text.match(/[\uAC00-\uD7A3]/g);
    return koreanChars ? koreanChars.length : 0;
}

/**
 * Updates the character count display.
 */
function updateCharCount() {
    const text = resultContainer.innerText || '';
    // Remove markers before counting
    const cleanText = text
        .replace(/⟨NEW⟩/g, '')
        .replace(/⟨\/NEW⟩/g, '')
        .replace(/⟨MOD⟩/g, '')
        .replace(/⟨\/MOD⟩/g, '');
    const count = countKoreanChars(cleanText);
    charCountElement.textContent = `한글(공백제외): ${count}`;
    
    const hasContent = cleanText.length > 0;
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
    imageFiles = [];

    const filePromises = Array.from(files).slice(0, 20).map(async (file, index) => {
        if (file.type.startsWith('image/')) {
            imageFiles.push(file);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'image-preview-item';
                itemDiv.dataset.index = index.toString();
                
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
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'image-delete-btn';
                deleteBtn.innerHTML = '×';
                deleteBtn.title = '이미지 삭제';
                deleteBtn.onclick = () => removeImage(index);
                
                itemDiv.appendChild(img);
                itemDiv.appendChild(deleteBtn);
                imagePreview.appendChild(itemDiv);
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
 * Removes an image from the preview and updates the arrays.
 */
function removeImage(index: number) {
    // 배열에서 해당 인덱스 제거
    imageFiles.splice(index, 1);
    imageParts.splice(index, 1);
    
    // 프리뷰 다시 렌더링
    updateImagePreview();
}

/**
 * Updates the image preview after deletion.
 */
async function updateImagePreview() {
    imagePreview.innerHTML = '';
    imageParts = [];
    
    const filePromises = imageFiles.map(async (file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'image-preview-item';
            itemDiv.dataset.index = index.toString();
            
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
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'image-delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = '이미지 삭제';
            deleteBtn.onclick = () => removeImage(index);
            
            itemDiv.appendChild(img);
            itemDiv.appendChild(deleteBtn);
            imagePreview.appendChild(itemDiv);
        };
        reader.readAsDataURL(file);
        return fileToGenerativePart(file);
    });
    
    const parts = await Promise.all(filePromises);
    imageParts = parts.filter((part): part is Part => part !== null);
}

/**
 * Handles sample manuscript .docx file selection.
 */
async function handleSampleFile(file: File | null) {
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
 * Exports the content of the result container to a .docx file.
 */
async function exportToWord() {
    const content = resultContainer.innerText;
    if (!content) return;

    // Process content with color markers
    const lines = content.split('\n');
    const paragraphs = lines.map(line => {
        const children: any[] = [];
        
        // Process each line for markers
        let remainingText = line;
        let lastIndex = 0;
        
        // Process NEW markers (blue, bold)
        const newRegex = /⟨NEW⟩([\s\S]*?)⟨\/NEW⟩/g;
        const modRegex = /⟨MOD⟩([\s\S]*?)⟨\/MOD⟩/g;
        
        // Create a combined pattern to process in order
        const combinedPattern = /⟨(NEW|MOD)⟩([\s\S]*?)⟨\/(NEW|MOD)⟩/g;
        let match;
        let processedLine = line;
        let segments: {text: string, type: string}[] = [];
        let lastEnd = 0;
        
        while ((match = combinedPattern.exec(line)) !== null) {
            // Add text before the match
            if (match.index > lastEnd) {
                segments.push({
                    text: line.substring(lastEnd, match.index),
                    type: 'normal'
                });
            }
            
            // Add the matched content with its type
            segments.push({
                text: match[2],
                type: match[1]
            });
            
            lastEnd = match.index + match[0].length;
        }
        
        // Add remaining text
        if (lastEnd < line.length) {
            segments.push({
                text: line.substring(lastEnd),
                type: 'normal'
            });
        }
        
        // If no markers found, treat entire line as normal
        if (segments.length === 0) {
            segments.push({
                text: line,
                type: 'normal'
            });
        }
        
        // Create TextRuns with appropriate formatting
        segments.forEach(segment => {
            if (segment.type === 'NEW') {
                children.push(new TextRun({
                    text: segment.text,
                    bold: true,
                    color: '0066CC' // Blue
                }));
            } else if (segment.type === 'MOD') {
                children.push(new TextRun({
                    text: segment.text,
                    bold: true,
                    color: 'CC6600' // Orange
                }));
            } else {
                children.push(new TextRun({
                    text: segment.text
                }));
            }
        });
        
        return new Paragraph({ children });
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
 * Main function to generate the blog post.
 */
async function generateBlogPost() {
    // API 키 확인
    if (!API_KEY || API_KEY.trim() === '') {
        alert('Gemini API 키를 입력해주세요.');
        apiKeyInput.focus();
        return;
    }

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // API 키가 변경되었을 수 있으므로 다시 초기화
    const currentApiKey = apiKeyInput.value || API_KEY;
    const currentAi = new GoogleGenAI({ apiKey: currentApiKey });

    generateButton.disabled = true;
    loadingIndicator.classList.remove('hidden');
    resultContainer.textContent = '';
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
2.  **Keywords**: Naturally include the main keyword(s) at least 5 times in the post.
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

**VISUAL DISTINCTION REQUIREMENT:**
To help identify what content is new vs. original, mark all newly written or modified content with special markers:
- For newly written sentences/paragraphs: Wrap them with ⟨NEW⟩...⟨/NEW⟩
- For modified parts within existing sentences: Wrap only the changed portion with ⟨MOD⟩...⟨/MOD⟩
- Keep original unchanged text without any markers

Example output format:
원래 있던 문장입니다. ⟨MOD⟩샤슬릭 마산점⟨/MOD⟩에 방문했습니다.
⟨NEW⟩완전히 새로 작성한 문장입니다.⟨/NEW⟩
기존 형식 그대로 유지한 문장입니다.

**Mandatory Rules:**
1. **Final Length**: Must be between ${minChars} and ${maxChars} Korean characters (excluding spaces).
2. **Keywords**: Include main keyword(s) at least 5 times naturally.
3. **Title**: Include blog post title within the first 100 characters.
4. **Formatting**: Keep every single sentence ending with a newline.
5. **Plain Text**: No markdown or special formatting characters except for the NEW/MOD markers.
6. **Image Format**: Maintain exact image marker format from sample with one blank line between blocks.

IMPORTANT: The goal is to make it look like the same writer wrote about a different store, keeping their unique style and format intact, while clearly marking what has been changed.
`;

    const masterPrompt = sampleContent ? sampleBasedPrompt : basePrompt;

    try {
        const contents = {
            parts: [{ text: masterPrompt }, ...imageParts],
        };
        
        const responseStream = await currentAi.models.generateContentStream({
            model: model,
            contents: contents,
        });

        let fullText = '';
        for await (const chunk of responseStream) {
            fullText += chunk.text;
            // Process markers and display with formatting
            const processedText = fullText
                .replace(/⟨NEW⟩([\s\S]*?)⟨\/NEW⟩/g, '<span style="color: #0066cc; font-weight: bold;">$1</span>')
                .replace(/⟨MOD⟩([\s\S]*?)⟨\/MOD⟩/g, '<span style="color: #cc6600; font-weight: bold;">$1</span>')
                .replace(/\n/g, '<br>');
            
            // Use innerHTML for formatted display
            resultContainer.innerHTML = processedText;
            updateCharCount();
        }

    } catch (error) {
        console.error(error);
        resultContainer.textContent = '콘텐츠 생성 중 오류가 발생했습니다. 콘솔을 확인해주세요.';
    } finally {
        generateButton.disabled = false;
        loadingIndicator.classList.add('hidden');
        updateCharCount(); // Final check
    }
}

// --- Event Listeners Setup ---

form.addEventListener('submit', (e) => {
    e.preventDefault();
    generateBlogPost();
});

sampleUploadInput.addEventListener('change', () => {
    handleSampleFile(sampleUploadInput.files ? sampleUploadInput.files[0] : null);
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

resultContainer.addEventListener('input', updateCharCount);

copyButton.addEventListener('click', () => {
    if (resultContainer.innerText) {
        // Remove markers before copying
        const cleanText = resultContainer.innerText
            .replace(/⟨NEW⟩/g, '')
            .replace(/⟨\/NEW⟩/g, '')
            .replace(/⟨MOD⟩/g, '')
            .replace(/⟨\/MOD⟩/g, '');
        
        navigator.clipboard.writeText(cleanText)
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