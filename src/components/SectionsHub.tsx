import React from 'react';
import type { Language } from '../types';
import type { ApplicationRoute } from '../security/permissions';
import './SectionsHub.css';

export interface SectionsHubItem {
  id: ApplicationRoute;
  menuId: string;
  icon: string;
  en: string;
  ar: string;
  group: string;
}

interface SectionsHubProps {
  items: SectionsHubItem[];
  language: Language;
  activeId: string;
  onOpen: (id: ApplicationRoute) => void;
  renderIcon: (name: string) => React.ReactNode;
}

const groupLabels: Record<string, { en: string; ar: string }> = {
  OPERATIONS: { en: 'OPERATIONS', ar: 'التشغيل' },
  ENGINEERING: { en: 'ENGINEERING', ar: 'الهندسة' },
  SYSTEM: { en: 'SYSTEM', ar: 'النظام' },
  ADMIN: { en: 'ADMIN', ar: 'الإدارة' }
};

const descriptions: Record<string, { en: string; ar: string }> = {
  dashboard: { en: 'Operational overview and equipment indicators', ar: 'نظرة عامة ومؤشرات المعدات والتشغيل' },
  warehouse: { en: 'Explore the conceptual warehouse and shuttle routes', ar: 'استكشف المخزن التصوري ومسارات الشاتل' },
  fleet: { en: 'Equipment identity, status and service records', ar: 'بيانات المعدات والحالة وسجلات الخدمة' },
  shifts: { en: 'Shift activity, handover and operating notes', ar: 'نشاط الورديات والتسليم وملاحظات التشغيل' },
  engineering: { en: 'Interactive mechanical reference assemblies', ar: 'نماذج هندسية ميكانيكية تفاعلية' },
  batteries: { en: 'Battery register, assignment and movement history', ar: 'سجل البطاريات والتخصيص وحركة التداول' },
  faults: { en: 'Fault observations, investigations and actions', ar: 'بلاغات الأعطال والفحص والإجراءات التصحيحية' },
  maintenance: { en: 'Preventive and corrective work orders', ar: 'أوامر الصيانة الوقائية والتصحيحية' },
  connections: { en: 'Read-only communication architecture and endpoints', ar: 'بنية الاتصالات ونقاط الربط للقراءة فقط' },
  ai: { en: 'Technical checklists and assisted troubleshooting', ar: 'قوائم الفحص الفني والمساعدة في استكشاف الأعطال' },
  reports: { en: 'Operational summaries and exportable records', ar: 'ملخصات التشغيل والسجلات القابلة للتصدير' },
  notifications: { en: 'Local alerts and activity notifications', ar: 'التنبيهات المحلية وإشعارات النشاط' },
  users: { en: 'Local accounts, roles and access controls', ar: 'الحسابات المحلية والأدوار وصلاحيات الوصول' },
  settings: { en: 'Application language, appearance and data tools', ar: 'لغة التطبيق والمظهر وأدوات البيانات' }
};

export default function SectionsHub({ items, language, activeId, onOpen, renderIcon }: SectionsHubProps) {
  const ar = language === 'ar';
  const groups = ['OPERATIONS', 'ENGINEERING', 'SYSTEM', 'ADMIN'];
  return (
    <section className="sections-hub page-content" aria-label={ar ? 'كل الأقسام' : 'All sections'}>
      <header className="sections-hub-heading">
        <span className="sections-hub-kicker">SHUTTLE CONTROL / WORKSPACE DIRECTORY</span>
        <h2>{ar ? 'كل الأقسام' : 'All sections'}</h2>
        <p>{ar ? 'انتقل مباشرة إلى وحدات التشغيل والهندسة والنظام المتاحة لحسابك.' : 'Jump directly to the operational, engineering and system workspaces available to your role.'}</p>
      </header>
      {groups.map(group => {
        const groupItems = items.filter(item => item.group === group);
        if (groupItems.length === 0) return null;
        return (
          <section className="sections-hub-group" key={group} aria-label={ar ? groupLabels[group].ar : groupLabels[group].en}>
            <div className="sections-hub-group-title"><span>{ar ? groupLabels[group].ar : groupLabels[group].en}</span><i /></div>
            <div className="sections-hub-grid">
              {groupItems.map(item => {
                const description = descriptions[item.id] || { en: 'Open this application workspace', ar: 'افتح قسم العمل هذا' };
                return (
                  <button className={'sections-hub-card' + (activeId === item.id ? ' active' : '')} type="button" key={item.menuId} data-section-id={item.id} aria-current={activeId === item.id ? 'page' : undefined} onClick={() => onOpen(item.id)}>
                    <span className="sections-hub-icon">{renderIcon(item.icon)}</span>
                    <span className="sections-hub-card-copy"><strong>{ar ? item.ar : item.en}</strong><small>{ar ? description.ar : description.en}</small></span>
                    <span className="sections-hub-open">{ar ? 'فتح' : 'Open'} <span aria-hidden="true">↗</span></span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </section>
  );
}
