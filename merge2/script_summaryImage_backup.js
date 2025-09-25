  async createSummaryImage(imgs) {
    return new Promise((resolve) => {
      try {
        // 이미지가 없는 경우 처리
        if (!imgs || imgs.length === 0) {
          resolve(null);
          return;
        }

        // Canvas 생성
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 원고 작성용 설정: 각 이미지를 가로 600px로 리사이즈
        const targetWidth = 600;
        const spacing = 10; // 이미지 간 간격
        
        // 각 이미지 정보 수집
        const imagePromises = Array.from(imgs).map((img, index) => {
          return new Promise((imgResolve) => {
            const tempImg = new Image();
            tempImg.onload = function() {
              const scale = targetWidth / tempImg.width;
              const scaledHeight = Math.round(tempImg.height * scale);
              imgResolve({
                img: tempImg,
                originalSrc: img.src,
                width: targetWidth,
                height: scaledHeight,
                index: index
              });
            };
            tempImg.onerror = function() {
              console.warn(`이미지 로드 실패: ${index + 1}번째`);
              imgResolve(null);
            };
            tempImg.src = img.src;
          });
        });

        // 모든 이미지 로드 대기
        const loadedImages = await Promise.all(imagePromises);
        const validImages = loadedImages.filter(img => img !== null);
        
        if (validImages.length === 0) {
          resolve(null);
          return;
        }

        // 전체 높이 계산
        let totalHeight = 0;
        validImages.forEach((imgInfo, index) => {
          totalHeight += imgInfo.height;
          if (index < validImages.length - 1) {
            totalHeight += spacing;
          }
        });

        // 캔버스 크기 설정
        canvas.width = targetWidth;
        canvas.height = totalHeight;
        
        // 흰색 배경
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, targetWidth, totalHeight);
        
        // 이미지 그리기
        let currentY = 0;
        validImages.forEach((imgInfo, index) => {
          ctx.drawImage(imgInfo.img, 0, currentY, targetWidth, imgInfo.height);
          currentY += imgInfo.height;
          
          // 마지막 이미지가 아니면 간격 추가
          if (index < validImages.length - 1) {
            currentY += spacing;
            // 간격 부분을 흰색으로 채우기
            ctx.fillStyle = 'white';
            ctx.fillRect(0, currentY - spacing, targetWidth, spacing);
          }
        });
        
        // Blob으로 변환
        canvas.toBlob((blob) => {
          console.log(`총합본 생성 완료: ${validImages.length}개 이미지, 크기: ${targetWidth}x${totalHeight}px`);
          resolve(blob);
        }, 'image/jpeg', 0.85); // 파일 크기 최적화를 위해 품질 85%
        
      } catch (error) {
        console.error('Summary image creation error:', error);
        resolve(null);
      }
    });
  }
