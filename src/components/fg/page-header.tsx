import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  tabs,
}: PageHeaderProps) {
  return (
    <div className="fg-page-head">
      <div className="fg-page-head-top">
        <div>
          {eyebrow && <div className="fg-page-eyebrow">{eyebrow}</div>}
          <h1 className="fg-page-title">{title}</h1>
          {description && <p className="fg-page-desc">{description}</p>}
        </div>
        {actions && <div className="fg-page-actions">{actions}</div>}
      </div>
      {tabs && <div className="fg-page-tabs">{tabs}</div>}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="fg-page">{children}</div>;
}
