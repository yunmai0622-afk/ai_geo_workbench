import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { hasError: boolean };

/** 发布页局部错误边界：避免 React 渲染异常导致整页白屏 */
export class PublishCenterErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-6 pb-12" data-testid="publish-center-page">
          <header className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">平台适配发布</h1>
          </header>
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="alert"
            data-testid="publish-center-render-fallback"
          >
            发布任务暂时无法加载，请稍后重试。
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
