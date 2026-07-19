# 개발 이력

## 2026-07-19 — 2차 리뷰 버그 7건 전부 수정

### 변경
- **`'fail'` 게임 상태 도입** (`solitaire.ts`) — `GameState`에 `'fail'` 추가, `fail()` 메서드 신설. `_onFail()`이 상태를 전이해 패배 후 flipStock/moveCard/undo/드래그가 상태 검사만으로 차단(버그 1). `undo()`도 play/pause 외 상태 거부.
- **교착 판정 1수 앞보기** (`solitaire.ts` `hasAnyMove()` 4단계 추가) — Foundation 톱 카드를 태블로로 내렸을 때 그 위에 올릴 후보(반대 색·숫자-1)가 스톡∪웨이스트/태블로 시퀀스에 있으면 생산적 이동으로 인정. 승리 가능한 판의 자동 패배 오탐 해소(버그 5).
- **모달 입력 차단** (`input.ts`) — `InputCallbacks.isModalOpen()` 추가. 도움말/확인 팝업 열림 시 F1/Esc 외 게임 키·드래그·더블클릭 차단(버그 7).
- **컨트롤러 정리** (`main.ts`) —
  - `N` 키를 `_requestNewGame()`에 연결해 확인 팝업 경유(버그 2)
  - `_overlayTimer`로 승리/패배 오버레이 지연 표시를 `_hideAllOverlays()`에서 취소(버그 3)
  - `_pausedByConfirm` 플래그로 확인 팝업 취소 시 수동 일시정지 유지(버그 4)
  - `_doRestart()`에 `_ended = true` — 이펙트 중 조작·pagehide 재저장 차단(버그 6)
  - `_requestRestart()`가 fail 상태 허용 — 교착/포기 후 같은 배열 재도전 가능
  - `_undo`/`_flipStock`/`_handleMove`/`_handleAutoMove`/`_autoComplete`에 `_ended` 가드, `_togglePause`에 fail 차단, `_toggleHelp`에 확인 팝업 가드

### 검증
- `tsc` 빌드 통과(strict), `dist/` 재생성.
- 노드 테스트 14건 전부 통과: Foundation→태블로 앞보기 오탐 해소(♥7→♠8 후 ♣6 수락) / 진짜 교착 유지(받아줄 검정 8 없음 → false) / fail 상태에서 flipStock·moveCard·moveFromWaste·autoMoveAll·undo·pause/resume 차단 / fail 후 restart()로 재시작 가능.
- DOM 의존 항목(버그 2·3·4·6·7)은 코드 경로 추적으로 검증(브라우저 수동 테스트 권장).

## 2026-07-19 — 2차 코드 리뷰 및 Todo.md 갱신

### 범위
- 1차 리뷰 수정분 + 교착 감지(a27fb9f) 반영 후 `src/` 8개 파일(3,030줄), `index.html` 재리뷰.
- `tsc --noEmit` 통과, `dist/`가 소스와 동일 시각으로 최신임을 확인.

### 결과 (Todo.md "2차 코드 리뷰 결과" 섹션에 기록)
- **버그 7건 발견 (미수정)**: ① 패배 후 `game.state`가 `'play'`로 남아 키보드 입력 계속 동작, ② 키보드 `N`이 확인 팝업 없이 즉시 새 게임(`onNewGame`→`_newGame` 직결), ③ 승리/패배 오버레이 `setTimeout` 미취소로 새 판 위에 뒤늦게 표시, ④ 수동 일시정지가 확인 팝업 취소 시 강제 해제, ⑤ 교착 판정의 Foundation→태블로 일괄 제외로 승리 가능한 판을 자동 패배시킬 가능성, ⑥ 다시하기 이펙트 중 입력/저장 보호 없음(pagehide 시 파기한 판 부활), ⑦ 도움말 열림 중 키보드 플레이 가능 + 타이머 정지로 기록 왜곡.
- **개선 권장 5건**: 입력 허용 질의 콜백 일원화, `'fail'` 상태 추가, `StockDeck.drawCard()` 주석 수정, `restore()` 실패 시 덱 초기화, 교착 자동 패배의 경고 완화 옵션.

## 2026-07-19 — 교착(더 이상 이동 불가) 자동 감지 추가

### 배경
- "포기" 시 `fail-overlay` 문구가 "더 이상 이동할 수 없습니다."로 고정되어, 자동 교착 감지가 없는데도 자동 감지처럼 오인됨.

### 변경
- **문구 분리** — `index.html` fail 문구에 `id="fail-msg"` 부여. `main._onFail(reason)`이 포기 시 "게임을 포기했습니다.", 교착 시 "더 이상 이동할 수 없습니다."로 설정.
- **교착 판정** — `SolitaireGame.hasAnyMove()` 추가. 생산적 이동 판정:
  - 태블로 맨 위 → Foundation
  - 스톡 ∪ 웨이스트의 모든 카드(드로우 1장 + 무한 재순환이므로 전부 도달 가능) → Foundation/태블로
  - 태블로 유효 시퀀스 → 다른 태블로
  - 제외(비생산적·되돌림 가능): 스톡 순환 자체, 컬럼 전체→빈 칸 King 셔플, Foundation→태블로 되돌리기 (교착 오탐 방지)
- **자동 종료** — `main._checkDeadlock()`을 이동/자동이동/자동완성/스톡뒤집기 성공 직후 호출. `_ended` 플래그로 승리/포기/교착 중복 처리 방지, 새 게임·재시작·이어하기에서 리셋.

### 검증
- `tsc` 빌드 통과(strict/noUnusedLocals), `dist/` 재생성.
- 노드 속성 테스트: 400딜 × 120,000 중간 상태에서 `hasAnyMove()` vs 브루트포스(전체 스톡 순환 포함 API 열거) 불일치 0건.
- 구성된 확정 교착판(모든 태블로 top=검정·비A, 빈 열 없음, 스톡/웨이스트 빈) → `hasAnyMove()=false`, 단일 API 이동 전부 실패 확인.

## 2026-07-19 — 코드 리뷰 지적 버그 10건 + 개선 5건 전부 수정

### 버그 수정 (10건)
1. **다시 하기 동일 배열 재시작** — `SolitaireGame.deal()`에서 초기 배치를 `_initialDeal`로 스냅샷, `restart()` 추가. `main._doRestart` → 이펙트 후 `_restartSameDeal()`로 복원. IndexedDB 스냅샷에도 `initialDeal` 저장(이어하기 후에도 유지).
2. **Esc로 도움말 닫기** — `InputCallbacks.onEscapeModal` 추가, Esc 시 도움말/확인 팝업을 우선 닫음.
3. **N 키 시작 무음** — `_newGame()`/`_restartSameDeal()`에서 `sound.init()` 호출.
4. **한글 IME 단축키** — 키 매핑을 `e.key` → `e.code`(KeyS/KeyZ/Digit1…, Numpad1~7 포함)로 변경.
5. **키보드 부분 시퀀스 이동** — `_kbMovableCount`가 시퀀스 전체→1장까지 줄여가며 수락 가능한 최대 개수 탐색.
6. **웨이스트 더블클릭 히트 영역** — `_getDeckAt` 웨이스트 판정 폭을 fan-out 오프셋만큼 확장.
7. **승리 후 undo 차단** — `_undo()`가 play/pause 상태에서만 동작.
8. **확인 팝업 위 Esc 상태 꼬임** — #2로 팝업 우선 닫힘 + 확인 팝업 열림 시 `_togglePause` 무시.
9. **이펙트 중 카드 이중 표시** — `_animDecks`로 애니메이션 중인 덱 추적, `_drawBoard`에서 렌더 생략.
10. **애니메이션 프레임레이트 종속** — `performance.now()` dt 기반 물리 스텝 스케일(60fps 기준), dt 0.05s 클램프.

### 개선 (5건, 선택)
- iOS Safari: `sound.init()`/`play()`에서 suspended 시 `ctx.resume()`.
- `restore()` 무결성 검증(`_validateDecks`, 52장/중복) 후 실패 시 null 반환.
- 멀티터치: 드래그 시작 터치 `_activeTouchId` 추적, 두 번째 손가락 무시.
- `MoveCommand.stockCount` 제거(SavedMove 필드는 하위호환 위해 optional 유지).
- `void cardH`/`void this._rafId` 정리(`_rafId` 필드 제거).

### 검증
- `tsc --noEmit` 통과(strict/noUnusedLocals), `tsc` 빌드로 `dist/` 재생성.
- DOM-free 코어 로직 노드 테스트 12건 통과: restart 동일배열, serialize/restore 왕복, initialDeal 유지, 무결성 검증(중복·버전 거부).

## 2026-07-19 — 전체 코드 리뷰 및 Todo.md 갱신

- src/ 전체 8개 파일(2,738줄) + index.html 코드 리뷰 수행
- 요구사항 17개 충족 현황 점검: 15개 충족, 2개 부분 충족(키보드 부분 시퀀스 이동, F1 도움말 Esc 닫기)
- 버그 10건 발견하여 Todo.md에 체크리스트로 기록
  - 주요: "다시 하기"가 같은 배열로 재시작되지 않음, 한글 IME에서 단축키 미동작, N 키 시작 시 무음
- 개선 권장 5건 추가 (iOS AudioContext resume, 스냅샷 검증, 멀티터치 등)
- 코드 수정은 하지 않음 (리뷰만 수행)

## 2026-07-19 — 단일 파일 릴리스 빌드

### 작업 내용
`build.sh` / `build.bat`를 단일 자체 완결형 `index.html` 하나만 생성하도록 변경.
CSS·JS 번들·favicon·모든 이미지(70개 PNG)를 data URI로 인라인하여 외부 파일 의존 제거.

### 변경/추가된 파일
| 파일 | 설명 |
|------|------|
| `build.sh` | tsc 타입체크 → esbuild IIFE 번들 → 인라인 → `release/index.html` |
| `build.bat` | 위와 동일 흐름의 Windows 버전 |
| `build-inline.cjs` | CSS/JS/favicon/이미지 인라인 공유 스크립트 (sh·bat 공용) |

### 방식
- `esbuild`로 `src/main.ts` + 모든 모듈을 단일 IIFE로 번들
- `img/` 전체를 base64 data URI 맵(`globalThis.__IMG__`)으로 임베드
- `loadImages()`가 파일 대신 임베드된 data URI를 우선 사용하도록 번들 패치
- 결과: `release/index.html` (약 898KB), 외부 참조 0개 — 파일 하나로 실행

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
