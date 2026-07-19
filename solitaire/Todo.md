## 목표
아래 폴더의 Android Solitaire 게임을 Web 으로 포팅할 계획 입니다.
원본 소스: c:\github2\solitaire2\src\solitaire\app\src\
참고 소스: c:\github2\freecell\src\webgame\

## 요구사항
1. HTML5의 Canvas를 사용 하십시오.
2. 모바일에서도 동작해야 하며, 폴드7 접은 화면과 펼친 화면이 모두 타겟입니다.
3. 키보드, 마우스, 터치 스크린을 모두 지원 합니다.
4. 포팅 중 버그가 있으면 개선해 주세요.
5. 포팅 후 사운드 효과를 넣어 주세요. 반드시 무료 사운드를 이용해야 합니다.
6. 포팅 후 게임 실패시 카드가 불타거나 바람에 흩날리는 이펙트를 넣어 주세요.
7. Typescript를 사용해 주세요
8. 실행시 인터넷으로 로딩해야 하는 외부 라이브러리는 사용하면 안됩니다. 단, 사운드 효과는 무료 사운드 라이브러리를 사용할 수 있습니다.
9. 게임은 싱글 플레이어로 구현해 주세요.
10. 게임은 완성된 형태로 구현해 주세요. (게임 시작, 카드 이동, 게임 종료 등 모든 기능이 구현되어야 합니다.)
11. 게임 UI는 인터넷 검색으로 보다 좋은 UI가 있으면 참고해서 구현해 주세요.
12. 이미지 리소스는 img 폴더에 있는 것을 사용하세요.
13. 키보드로만으로도 게임을 할 수 있게 해주세요.
14. F1을 누르면 도움말이 나오게 해주세요
15. 브라우저의 IndexDB를 사용해 브라우저를 종료했다 다시켜도 이어하기가 가능하게 해주세요.
16. Ctrl을 누르고 있으면, 카드위에 어떤 키랑 맵핑이 되는지를 보여주세요.
17. 참고 소스의 최대한 많은 부분을 재활용 하세요.

---

## 코드 리뷰 결과 (2026-07-19)

src/ 전체 8개 파일(2,738줄), index.html, tsconfig.json 리뷰 기준.

### 요구사항 충족 현황

| # | 요구사항 | 상태 | 비고 |
|---|---------|------|------|
| 1 | HTML5 Canvas | ✅ | renderer.ts |
| 2 | 모바일 / 폴드7 대응 | ✅ | calcLayout 반응형 + ResizeObserver + orientationchange |
| 3 | 키보드·마우스·터치 지원 | ✅ | input.ts (단, 버그 5 참고) |
| 4 | 포팅 중 버그 개선 | 🔶 | 아래 발견 버그 수정 필요 |
| 5 | 무료 사운드 | ✅ | Web Audio API 합성음 — 외부 파일 자체가 없음 |
| 6 | 실패 시 불/바람 이펙트 | ✅ | startFailEffect (renderer.ts) |
| 7 | TypeScript | ✅ | strict 모드 |
| 8 | 외부 라이브러리 미사용 | ✅ | 의존성 0 |
| 9 | 싱글 플레이어 | ✅ | |
| 10 | 완성된 게임 흐름 | ✅ | 시작/이동/승리/패배/일시정지/포기/다시하기 |
| 11 | UI 개선 참고 | ✅ | 오버레이·토스트·자동완성 버튼 등 |
| 12 | img 폴더 리소스 사용 | ✅ | 카드 52장 + abg/bg, 로드 실패 시 대체 렌더링 |
| 13 | 키보드만으로 플레이 | 🔶 | 부분 시퀀스 이동 불가 (버그 5) |
| 14 | F1 도움말 | ✅ | Esc로는 안 닫힘 (버그 2) |
| 15 | IndexedDB 이어하기 | ✅ | 자동저장(디바운스 800ms) + pagehide/visibilitychange |
| 16 | Ctrl 키 매핑 오버레이 | ✅ | _drawKeyOverlay + blur 시 해제 처리 |
| 17 | 참고 소스 재활용 | ✅ | sound.ts / storage.ts 구조 재사용 |

### 발견된 버그 (수정 필요)

- [x] **1. "다시 하기"가 같은 카드 배열로 재시작되지 않음** — `deal()`에서 초기 배치를 `_initialDeal` 스냅샷으로 저장하고 `restart()` 추가. `_doRestart`는 이펙트 후 `_restartSameDeal()`로 동일 배열 복원. 스냅샷은 IndexedDB에도 저장(`initialDeal`)해 이어하기 후에도 동작.
- [x] **2. Esc로 도움말이 닫히지 않음** — `onEscapeModal` 콜백 추가. Esc 시 도움말/확인 팝업을 먼저 닫도록 우선 처리(main.ts `_handleEscapeModal`).
- [x] **3. N 키로 첫 게임 시작 시 사운드 전체 무음** — `_newGame()`에서 `sound.init()` 호출(키다운 제스처 내). `_restartSameDeal`에도 추가.
- [x] **4. 한글 IME 상태에서 단축키 동작 안 함** — 키 매핑을 `e.key`→`e.code`(KeyS, KeyZ, Digit1…)로 변경. Numpad1~7도 지원.
- [x] **5. 키보드 이동이 전체 시퀀스만 시도** — `_kbMovableCount`가 시퀀스 전체→1장까지 줄여가며 목적지가 수락하는 최대 개수를 찾도록 변경.
- [x] **6. 웨이스트 더블클릭 히트 영역 어긋남** — `_getDeckAt`의 웨이스트 판정 폭을 fan-out 오프셋만큼 확장.
- [x] **7. 승리 후 Z(undo) 시 상태 불일치** — `_undo()`가 state가 play/pause일 때만 동작하도록 차단.
- [x] **8. 확인 팝업 위에서 Esc 시 팝업 뒤 상태 꼬임** — Esc가 팝업을 먼저 닫음(#2). 추가로 확인 팝업이 열려 있으면 `_togglePause` 무시.
- [x] **9. 이펙트 재생 중 카드 이중 표시** — 애니메이션 중인 덱을 `_animDecks`로 추적, `_drawBoard`에서 해당 덱 카드 렌더링 생략.
- [x] **10. 애니메이션이 프레임레이트 종속** — `performance.now()` 기반 dt로 물리 스텝을 스케일(60fps 기준), dt 클램프(0.05s)로 폭주 방지.

### 개선 권장 (선택)

- [x] iOS Safari 대응: `init()`/`play()`에서 AudioContext가 suspended면 `ctx.resume()` 호출.
- [x] `restore()`에 스냅샷 무결성 검증 추가 — `_validateDecks()`로 52장/중복 확인 후 실패 시 null 반환.
- [x] 멀티터치: 드래그를 시작한 터치 `identifier`를 추적(`_activeTouchId`)해 두 번째 손가락의 가로채기 방지.
- [x] `MoveCommand.stockCount` 제거 (serialize/restore/SavedMove에서 정리, 하위호환 위해 필드는 optional 유지).
- [x] `void cardH` / `void this._rafId` 등 noUnusedLocals 우회 코드 정리(`_rafId` 필드 제거, `_drawDragCards` 미사용 구조분해 제거).

---

## 2차 코드 리뷰 결과 (2026-07-19)

1차 리뷰 수정분 + 교착 감지(a27fb9f) 반영 후 src/ 8개 파일(3,030줄) 재리뷰. `tsc --noEmit` 통과, dist/ 최신 상태 확인.

### 발견된 버그 (전부 수정 완료)

- [x] **1. 패배 처리 후에도 게임 입력이 계속 동작** — `GameState`에 `'fail'` 추가, `SolitaireGame.fail()` 신설. `_onFail()`이 `game.fail()`을 호출해 flipStock/moveCard/undo/드래그가 상태 검사만으로 전부 차단됨. `_undo`/`_flipStock`/`_handleMove`/`_handleAutoMove`/`_autoComplete`에 `_ended` 가드도 추가(다시하기 이펙트 대비 이중 방어). `undo()` 자체도 play/pause 외 상태를 거부.
- [x] **2. 키보드 `N`이 확인 팝업 없이 즉시 새 게임** — `onNewGame` 콜백을 `_requestNewGame()`으로 연결. 진행 중(play/pause)이면 확인 팝업, 그 외(idle/win/fail)는 기존처럼 즉시 시작.
- [x] **3. 승리/패배 오버레이 `setTimeout` 미취소** — `_overlayTimer` 필드로 핸들 저장, `_hideAllOverlays()`에서 취소. 새 게임/다시하기/이어하기 모두 `_hideAllOverlays()`를 거치므로 뒤늦은 오버레이 표시가 사라짐.
- [x] **4. 수동 일시정지가 확인 팝업 취소로 강제 해제됨** — `_pausedByConfirm` 플래그 추가. `_pauseForConfirm()`이 직접 정지시킨 경우에만 `_dismissConfirm()`이 재개하고, 사용자가 걸어둔 일시정지는 유지.
- [x] **5. 교착 판정이 승리 가능한 판을 자동 패배시킬 수 있음** — `hasAnyMove()`에 4단계(Foundation→태블로 1수 앞보기) 추가: Foundation 톱 카드를 받아줄 태블로가 있고, 내린 카드 위에 올릴 후보(반대 색·숫자-1)가 스톡∪웨이스트 또는 태블로 이동 가능 시퀀스에 존재하면 생산적 이동으로 인정. 노드 테스트로 오탐 해소(시나리오 A)·진짜 교착 유지(시나리오 C) 확인.
- [x] **6. 다시하기 이펙트 재생 중 상태 보호 없음** — `_doRestart()` 진입 시 `_ended = true` 설정. 이펙트 중 Space 재개·Z 언두가 차단되고, pagehide 자동저장(saveNow)도 `_ended` 검사로 차단되어 파기한 판이 부활하지 않음. `_restartSameDeal()`이 `_ended = false`로 복원. 추가로 교착/포기(fail) 후에도 "다시 하기"로 같은 배열 재도전 가능하도록 `_requestRestart()`가 fail 상태를 허용.
- [x] **7. 도움말(F1) 열림 중 입력·타이머 불일치** — `InputCallbacks.isModalOpen()` 추가(도움말/확인 팝업). keydown에서 모달 열림 시 F1/Esc 외 게임 키 차단, `_onPress`/dblclick에도 가드. 확인 팝업 중 F1 도움말 열기도 금지(`_toggleHelp` 가드).

### 개선 권장 (선택)

- [x] InputHandler에 "입력 허용 여부" 질의 콜백(모달 열림 / `_ended`)을 추가해 전역 키 차단을 한 곳으로 모으기 — 버그 7 수정에서 `isModalOpen()` 콜백으로, `_ended`는 main 핸들러 가드로 구현.
- [x] 패배를 별도 게임 상태(`'fail'`)로 전이해 `_ended` 플래그 산재 제거 — 버그 1 수정에서 `'fail'` 상태 도입. (`_ended`는 다시하기 이펙트 구간 보호용으로 유지)
- [ ] `StockDeck.drawCard()` 주석 수정 — "팝하지 않음"이라고 되어 있으나 실제로는 pop한다.
- [ ] `restore()` 검증 실패 시 부분 복원된 덱이 인스턴스에 남음 — 현재는 호출측이 `_newGame()`으로 가리지만, 실패 경로에서 `_buildDecks()`로 되돌리는 방어 코드 권장.
- [ ] 교착 자동 패배를 "이동 불가" 경고 토스트 + 포기 유도로 완화하는 옵션 검토 — 버그 5의 오판 리스크를 구조적으로 낮춤.
