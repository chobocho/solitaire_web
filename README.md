# solitaire_web

HTML5 Canvas + TypeScript 기반 솔리테어 웹 게임

## 실행 방법

`solitaire/index.html`을 로컬 웹서버로 열거나, VS Code Live Server 등을 사용하세요.  
(file:// 프로토콜은 ES Module import로 인해 동작하지 않습니다.)

## 빌드

```bash
cd solitaire
npx tsc
```

## 게임 규칙

- **태블로 (7열)**: 교대 색상 + 내림차순. 빈 열에는 킹(K)만
- **파운데이션 (4개)**: 같은 무늬 A→K 순서로 완성
- **스톡**: 클릭하면 카드 1장씩 웨이스트로 뒤집기
- **웨이스트**: 맨 위 카드만 이동 가능. 스톡이 비면 재사용 가능
- **승리**: 52장 전부 Foundation에 올리면 승리

## 키보드 단축키

| 키 | 동작 |
|----|------|
| S | 스톡 뒤집기 |
| D | 웨이스트 선택 |
| Q/W/E/R | Foundation 1~4 |
| 1~7 | Tableau 열 1~7 |
| Enter | 선택 카드 → Foundation 자동이동 |
| Z | 되돌리기 |
| N | 새 게임 |
| F1 | 도움말 |
| Space | 일시정지/재개 |
| Ctrl (누르는 중) | 키 힌트 표시 |

## 기능

- 마우스 드래그, 터치 드래그, 키보드 완전 지원
- 더블클릭/더블탭으로 Foundation 자동이동
- IndexedDB 자동저장 (브라우저 재시작 후 이어하기)
- 승리/패배 애니메이션 이펙트
- Web Audio API 기반 사운드 효과 (외부 라이브러리 없음)
- 반응형 레이아웃 (모바일 포함)
