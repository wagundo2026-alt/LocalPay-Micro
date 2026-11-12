'use client';
import {Languages} from 'lucide-react';
import {useLanguage,type Locale} from '../lib/language';

export default function LanguageSwitcher(){
 const {locale,setLocale,t}=useLanguage();
 return <div className="lp-language-switcher" role="group" aria-label={t('language')}>
   <Languages size={16} aria-hidden="true"/>
   <label htmlFor="localpay-lang">{t('language')}</label>
   <select id="localpay-lang" aria-label={t('language')} value={locale}
     onChange={e=>setLocale(e.target.value as Locale)}>
     <option value="en">English</option>
     <option value="ve">Tshivenḓa</option>
   </select>
 </div>;
}
