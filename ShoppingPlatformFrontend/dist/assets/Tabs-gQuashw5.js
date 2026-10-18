import{r as n,j as o}from"./query-xElR5KUw.js";const d=n.createContext(null),u=({children:s,defaultValue:r,value:t,onValueChange:e,variant:i="line",className:x=""})=>{const[c,b]=n.useState(r),p=t!==void 0?t:c,a=l=>{t===void 0&&b(l),e==null||e(l)};return o.jsx(d.Provider,{value:{value:p,onChange:a,variant:i},children:o.jsx("div",{className:x,children:s})})},y=({children:s,className:r=""})=>{const{variant:t}=n.useContext(d),e={line:"border-b border-gray-200",pills:"bg-gray-100 p-1 rounded-lg",enclosed:"border-b border-gray-200"};return o.jsx("div",{role:"tablist",className:`flex gap-1 overflow-x-auto hide-scrollbar ${e[t]} ${r}`,children:s})},g=({children:s,value:r,disabled:t=!1,icon:e,badge:i,className:x=""})=>{const{value:c,onChange:b,variant:p}=n.useContext(d),a=c===r,l={line:`
      px-4 py-2.5 -mb-px border-b-2 transition-colors whitespace-nowrap flex-shrink-0
      ${a?"border-primary text-primary font-medium":"border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300"}
    `,pills:`
      px-4 py-2 rounded-md transition-all whitespace-nowrap flex-shrink-0
      ${a?"bg-white text-primary font-medium shadow-sm":"text-gray-600 hover:text-gray-800"}
    `,enclosed:`
      px-4 py-2.5 border border-transparent rounded-t-md -mb-px transition-colors whitespace-nowrap flex-shrink-0
      ${a?"bg-white border-gray-200 border-b-white text-primary font-medium":"text-gray-600 hover:text-gray-800"}
    `};return o.jsxs("button",{type:"button",role:"tab","aria-selected":a,disabled:t,onClick:()=>b(r),className:`
        flex items-center gap-2 text-sm
        disabled:opacity-50 disabled:cursor-not-allowed
        ${l[p]}
        ${x}
      `,children:[e&&o.jsx(e,{size:18}),s,i!==void 0&&o.jsx("span",{className:`
          px-1.5 py-0.5 text-xs rounded-full
          ${a?"bg-primary text-white":"bg-gray-200 text-gray-600"}
        `,children:i})]})},v=({children:s,value:r,className:t=""})=>{const{value:e}=n.useContext(d);return e!==r?null:o.jsx("div",{role:"tabpanel",className:`animate-fade-in ${t}`,children:s})};export{u as T,y as a,g as b,v as c};
