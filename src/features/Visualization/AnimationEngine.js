import { useEffect } from 'react';

// 애니메이션 상태를 관리하고 시각적 효과를 트리거하는 훅입니다.
export const useAnimationEngine = (state, dispatch) => {
    useEffect(() => {
        if (state.animationStatus) {
            // 1. 상태 변화에 따른 애니메이션 시작 (예: Push, Pull)
            console.log(`Animation started for: ${state.animationStatus}`);

            // 2. 일정 시간 후 애니메이션 상태 초기화 (CSS 트랜지션 완료 시간)
            const timer = setTimeout(() => {
                dispatch({ type: 'RESET_ANIMATION' }); // gitReducer에 추가할 액션
                console.log('Animation finished.');
            }, 1500);

            return () => clearTimeout(timer);
        }
    }, [state.animationStatus, dispatch]);
};
