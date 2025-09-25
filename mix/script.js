// 조합 생성 함수
function generateCombinations() {
    const combo2 = document.getElementById('combo2');
    const combo3 = document.getElementById('combo3');
    const combo4 = document.getElementById('combo4');
    
    // 2개 조합
    for (let i = 1; i <= 5; i++) {
        for (let j = 1; j <= 5; j++) {
            if (i !== j) {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = `${i},${j}`;
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${i}+${j}`));
                combo2.appendChild(label);
            }
        }
    }
    
    // 3개 조합
    for (let i = 1; i <= 5; i++) {
        for (let j = 1; j <= 5; j++) {
            for (let k = 1; k <= 5; k++) {
                if (i !== j && i !== k && j !== k) {
                    const label = document.createElement('label');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = `${i},${j},${k}`;
                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(` ${i}+${j}+${k}`));
                    combo3.appendChild(label);
                }
            }
        }
    }    // 4개 조합 (5개 중 4개 선택하는 모든 순열)
    for (let i = 1; i <= 5; i++) {
        for (let j = 1; j <= 5; j++) {
            for (let k = 1; k <= 5; k++) {
                for (let l = 1; l <= 5; l++) {
                    if (new Set([i, j, k, l]).size === 4) {
                        const label = document.createElement('label');
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = `${i},${j},${k},${l}`;
                        label.appendChild(checkbox);
                        label.appendChild(document.createTextNode(` ${i}+${j}+${k}+${l}`));
                        combo4.appendChild(label);
                    }
                }
            }
        }
    }
}

// 페이지 로드시 체크박스 생성
document.addEventListener('DOMContentLoaded', generateCombinations);

// 키워드 가져오기 (여러 줄 처리)
function getKeywords() {
    const keywords = {};
    for (let i = 1; i <= 5; i++) {
        const textarea = document.getElementById(`keyword${i}`);
        const lines = textarea.value.trim().split('\n').filter(line => line.trim());
        keywords[i] = lines;
    }
    return keywords;
}// 선택한 체크박스 조합 가져오기
function getSelectedCombinations() {
    const checkboxes = document.querySelectorAll('.checkbox-grid input[type="checkbox"]:checked');
    const combinations = [];
    checkboxes.forEach(checkbox => {
        const indices = checkbox.value.split(',').map(Number);
        combinations.push(indices);
    });
    return combinations;
}

// 카르테시안 곱 계산
function cartesianProduct(...arrays) {
    return arrays.reduce((acc, curr) => {
        const result = [];
        acc.forEach(a => {
            curr.forEach(b => {
                result.push([...a, b]);
            });
        });
        return result;
    }, [[]]);
}

// 조합 생성 (모든 가능한 조합)
function generateAllCombinations(combinations) {
    const keywords = getKeywords();
    const results = [];
    const useSpace = document.getElementById('saikanchk').checked;
    const separator = useSpace ? ' ' : '';
    
    combinations.forEach(combo => {
        const keywordArrays = combo.map(index => keywords[index] || []);
        
        // 모든 키워드가 존재하는지 확인
        if (keywordArrays.every(arr => arr.length > 0)) {
            const cartesian = cartesianProduct(...keywordArrays);
            cartesian.forEach(combination => {
                results.push(combination.join(separator));
            });
        }
    });
    
    return results;
}// 조합하기 버튼
document.getElementById('generateSelected').addEventListener('click', function() {
    const selectedCombos = getSelectedCombinations();
    
    if (selectedCombos.length === 0) {
        alert('조합을 선택해주세요!');
        return;
    }
    
    const keywords = getKeywords();
    let hasKeywords = false;
    for (let i = 1; i <= 5; i++) {
        if (keywords[i].length > 0) {
            hasKeywords = true;
            break;
        }
    }
    
    if (!hasKeywords) {
        alert('최소 1개 이상의 키워드를 입력해주세요!');
        return;
    }
    
    const results = generateAllCombinations(selectedCombos);
    document.getElementById('results').value = results.join('\n');
    document.getElementById('resultCount').textContent = `(${results.length}개)`;
});

// 전체 선택
document.getElementById('selectAll').addEventListener('click', function() {
    const checkboxes = document.querySelectorAll('.checkbox-grid input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
});

// 전체 해제
document.getElementById('deselectAll').addEventListener('click', function() {
    const checkboxes = document.querySelectorAll('.checkbox-grid input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
});// 결과 초기화
document.getElementById('clearResults').addEventListener('click', function() {
    document.getElementById('results').value = '';
    document.getElementById('resultCount').textContent = '';
});

// 토스트 메시지 표시 함수
function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// 결과 복사
document.getElementById('copyResults').addEventListener('click', function() {
    const results = document.getElementById('results');
    if (results.value === '') {
        showToast('복사할 결과가 없습니다!', 'error');
        return;
    }
    
    results.select();
    document.execCommand('copy');
    showToast('결과가 클립보드에 복사되었습니다!', 'success');
});

// 결과 다운로드
document.getElementById('downloadResults').addEventListener('click', function() {
    const results = document.getElementById('results');
    if (results.value === '') {
        showToast('다운로드할 결과가 없습니다!', 'error');
        return;
    }
    
    const blob = new Blob([results.value], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `keyword_combinations_${new Date().getTime()}.txt`;
    link.click();
    showToast('파일이 다운로드되었습니다!', 'success');
});

// Tab키로 다음 입력란으로 이동
document.querySelectorAll('textarea').forEach((textarea, index, textareas) => {
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const nextIndex = (index + 1) % 5;
            if (nextIndex < 5) {
                textareas[nextIndex].focus();
            }
        }
    });
});