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
const resultContainer = document.getElementById('result') as HTMLDivElement;
const loadingIndicator = document.getElementById('loading') as HTMLDivElement;
const charCountElement = document.getElementById('char-count') as HTMLSpanElement;
const keywordCountElement = document.getElementById('keyword-count') as HTMLSpanElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;
const exportButton = document.getElementById('export-button') as HTMLButtonElement;