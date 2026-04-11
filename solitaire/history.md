# 개발 이력

## 2026-04-11 — 초기 구현 (v1.0)

### 작업 내용
Android Solitaire 게임을 HTML5 Canvas + TypeScript 기반 웹 버전으로 포팅

### 구현된 파일
| 파일 | 설명 |
|------|------|
| `src/card.ts` | Card, Figure, CardNumber, Color 타입 (freecell 참조 재사용) |
| `src/deck.ts` | Deck 기반 클래스, FoundationDeck, TableauDeck, StockDeck, WasteDeck |
| `src/solitaire.ts` | 게임 로직 (deal, flipStock, moveCard, moveFromWaste, autoMoveToFoundation, undo, serialize/restore) |
| `src/renderer.ts` | Canvas 렌더링, 레이아웃 계산, 승리/패배 애니메이션 이펙트 |
| `src/input.ts` | 마우스/터치/키보드 입력 처리 |
| `src/sound.ts` | Web Audio API 기반 프로그래매틱 사운드 효과 |
| `src/storage.ts` | IndexedDB 기반 자동저장/불러오기 |
| `src/main.ts` | GameController, 타이머, UI 바인딩 |
| `index.html` | 게임 HTML 구조 |
| `css/style.css` | 반응형 스타일 |

### 주요 기능
- **게임 규칙**: 7열 태블로(킹만 빈 열 허용), 4개 파운데이션(A→K 같은 무늬), 스톡/웨이스트
- **입력**: 마우스 드래그, 터치 드래그, 더블클릭/더블탭 자동이동, 키보드 전체 지원
- **키보드 매핑**: S=스톡, D=웨이스트, Q/W/E/R=파운데이션, 1~7=태블로
- **Ctrl 오버레이**: Ctrl 누르는 동안 각 덱에 키 레이블 표시
- **F1 도움말**: 단축키 및 게임 규칙 설명
- **IndexedDB**: 브라우저 닫아도 이어하기 가능
- **승리 이펙트**: Foundation 카드들이 날아오르는 애니메이션
- **패배 이펙트**: 카드가 바람에 흩날리며 불타는 애니메이션
- **사운드**: Web Audio API로 합성된 카드 놓기/뒤집기/승리/패배/오류음
- **반응형**: 모바일(폴드 7 포함), 태블릿, 데스크톱 대응

### 참조
- Android 원본: `C:\github2\solitaire2\src\solitaire\app\src\`
- 참고 소스: `C:\github2\freecell\src\webgame\` (sound.ts, storage.ts 구조 재사용)
