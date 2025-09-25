// 배치 업로드 기능이 추가된 StateManager 수정 버전
// uploadImages 함수를 20개씩 나누어 업로드하도록 수정

// 기존 uploadImages 함수를 백업
if (!window.StateManager.prototype.uploadImagesOriginal) {
  window.StateManager.prototype.uploadImagesOriginal = window.StateManager.prototype.uploadImages;
}

// uploadImages 함수를 배치 처리 버전으로 교체
window.StateManager.prototype.uploadImages = async function(projectName, categoryName, files) {
  const BATCH_SIZE = 20; // PHP max_file_uploads 설정값
  
  // 파일이 배열이 아니면 배열로 변환
  const fileArray = Array.isArray(files) ? files : [files];
  
  console.log(`uploadImages 호출: ${fileArray.length}개 파일`);
  
  // 20개 이하면 기존 방식대로 처리
  if (fileArray.length <= BATCH_SIZE) {
    console.log(`${fileArray.length}개 파일 - 단일 배치로 처리`);
    return await this.uploadImagesBatch(projectName, categoryName, fileArray);
  }
  
  // 20개 초과면 배치로 나누어 처리
  console.log(`총 ${fileArray.length}개 파일을 ${BATCH_SIZE}개씩 나누어 업로드합니다.`);
  
  const allUploadedFiles = [];
  const totalBatches = Math.ceil(fileArray.length / BATCH_SIZE);
  
  for (let i = 0; i < fileArray.length; i += BATCH_SIZE) {
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const batch = fileArray.slice(i, i + BATCH_SIZE);
    
    console.log(`배치 ${batchNumber}/${totalBatches}: ${batch.length}개 파일 업로드 중...`);
    
    // 진행 상황 표시
    if (window.Utils && window.Utils.showProcessingMessage) {
      window.Utils.showProcessingMessage(
        `이미지 업로드 중... (${batchNumber}/${totalBatches} 배치, ${i + batch.length}/${fileArray.length} 파일)`
      );
    }
    
    try {
      const uploadedFiles = await this.uploadImagesBatch(projectName, categoryName, batch);
      if (uploadedFiles && uploadedFiles.length > 0) {
        allUploadedFiles.push(...uploadedFiles);
        console.log(`배치 ${batchNumber} 완료: ${uploadedFiles.length}개 파일 업로드됨`);
      }
      
      // 배치 간 약간의 지연을 두어 서버 부하 방지
      if (batchNumber < totalBatches) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`배치 ${batchNumber} 업로드 실패:`, error);
      throw new Error(`배치 ${batchNumber}/${totalBatches} 업로드 실패: ${error.message}`);
    }
  }
  
  console.log(`총 ${allUploadedFiles.length}개 파일 업로드 완료`);
  return allUploadedFiles;
};

// 단일 배치 업로드 함수 (기존 uploadImages 로직)
window.StateManager.prototype.uploadImagesBatch = async function(projectName, categoryName, files) {
  console.log(`uploadImagesBatch: ${files.length}개 파일 전송`);
  
  const formData = new FormData();
  formData.append('project', projectName);
  formData.append('category', categoryName);
  
  // 파일들을 FormData에 추가
  files.forEach((file, index) => {
    formData.append('images[]', file);
    console.log(`FormData에 추가: ${file.name} (${index + 1}/${files.length})`);
  });
  
  try {
    console.log(`API 호출: ${this.apiBaseUrl}/images.php`);
    const response = await fetch(`${this.apiBaseUrl}/images.php`, {
      method: 'POST',
      body: formData
    });
    
    // 응답 텍스트 먼저 확인
    const responseText = await response.text();
    console.log('서버 응답 (첫 200자):', responseText.substring(0, 200));
    
    // JSON 파싱 시도
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('이미지 업로드 응답 파싱 오류:', responseText);
      throw new Error('서버 응답을 파싱할 수 없습니다');
    }
    
    if (!data.success) {
      throw new Error(data.message || '이미지 업로드 실패');
    }
    
    console.log(`서버 응답: ${data.data ? data.data.length : 0}개 파일 업로드 성공`);
    return data.data || [];
  } catch (error) {
    console.error('배치 이미지 업로드 오류:', error);
    throw error;
  }
};

console.log('StateManager 배치 업로드 기능이 활성화되었습니다.');
console.log('20개 이상의 파일은 자동으로 배치 처리됩니다.');