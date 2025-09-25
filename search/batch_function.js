// 배치 처리 함수 - 실시간 업데이트 개선
async function processBatch(keywords, batchSize, requestInterval, useCache, onProgress) {
    const batchStatus = document.getElementById('batchStatus');
    
    for (let i = 0; i < keywords.length; i += batchSize) {
        const batch = keywords.slice(i, Math.min(i + batchSize, keywords.length));
        const batchPromises = [];
        
        // 배치 상태 표시
        if (batchStatus) {
            batchStatus.style.display = 'inline-block';
            const batchNum = Math.floor(i/batchSize) + 1;
            const totalBatches = Math.ceil(keywords.length/batchSize);
            batchStatus.textContent = `배치 ${batchNum}/${totalBatches} (${batch.length}개 동시)`;
        }
        
        for (const keyword of batch) {
            // 캐시 확인
            if (useCache) {
                const cached = await cacheManager.get(keyword);
                if (cached) {
                    const result = { ...cached, fromCache: true };
                    // 실시간으로 콜백 호출
                    if (onProgress) onProgress(result);
                    batchPromises.push(Promise.resolve(result));
                    continue;
                }
            }
            
            // API 호출 Promise 생성
            const apiPromise = callNaverAPI(keyword)
                .then(async (result) => {
                    if (result && !result.error && useCache) {
                        await cacheManager.set(keyword, result);
                    }
                    const finalResult = { ...result, fromCache: false };
                    // 실시간으로 콜백 호출
                    if (onProgress) onProgress(finalResult);
                    return finalResult;
                })
                .catch((err) => {
                    const errorResult = {
                        keyword: keyword,
                        error: err.message,
                        api_used: 'Failed',
                        fromCache: false
                    };
                    if (onProgress) onProgress(errorResult);
                    return errorResult;
                });
            
            batchPromises.push(apiPromise);
        }
        
        // 배치 내 모든 요청 동시 처리
        await Promise.all(batchPromises);
        
        // 다음 배치 전 대기 (마지막 배치 제외)
        if (i + batchSize < keywords.length) {
            await new Promise(resolve => setTimeout(resolve, requestInterval));
        }
    }
}
