import{r as m,j as r}from"./query-BRZwYufj.js";import{J as d}from"./index-Xfki6H2q.js";const u=m.forwardRef(({label:s,checked:e=!1,onChange:t,disabled:a=!1,error:n,className:i="",...o},l)=>r.jsxs("label",{className:`inline-flex items-center gap-3 cursor-pointer ${a?"cursor-not-allowed opacity-50":""} ${i}`,children:[r.jsxs("div",{className:"relative",children:[r.jsx("input",{ref:l,type:"checkbox",checked:e,onChange:t,disabled:a,className:"sr-only peer",...o}),r.jsx("div",{className:`
          w-5 h-5 border-2 rounded transition-all duration-200
          flex items-center justify-center
          peer-focus:ring-2 peer-focus:ring-primary/20 peer-focus:ring-offset-1
          ${e?"bg-primary border-primary":"bg-white border-gray-300 hover:border-gray-400"}
          ${n?"border-error":""}
        `,children:e&&r.jsx(d,{size:14,className:"text-white",strokeWidth:3})})]}),s&&r.jsx("span",{className:"text-sm text-gray-700 select-none",children:s})]}));u.displayName="Checkbox";const f=m.forwardRef(({label:s,checked:e=!1,onChange:t,disabled:a=!1,name:n,value:i,className:o="",...l},p)=>r.jsxs("label",{className:`inline-flex items-center gap-3 cursor-pointer ${a?"cursor-not-allowed opacity-50":""} ${o}`,children:[r.jsxs("div",{className:"relative",children:[r.jsx("input",{ref:p,type:"radio",name:n,value:i,checked:e,onChange:t,disabled:a,className:"sr-only peer",...l}),r.jsx("div",{className:`
          w-5 h-5 border-2 rounded-full transition-all duration-200
          flex items-center justify-center
          peer-focus:ring-2 peer-focus:ring-primary/20 peer-focus:ring-offset-1
          ${e?"border-primary":"bg-white border-gray-300 hover:border-gray-400"}
        `,children:e&&r.jsx("div",{className:"w-2.5 h-2.5 bg-primary rounded-full"})})]}),s&&r.jsx("span",{className:"text-sm text-gray-700 select-none",children:s})]}));f.displayName="Radio";const x=m.forwardRef(({label:s,checked:e=!1,onChange:t,disabled:a=!1,size:n="md",className:i="",...o},l)=>{const c={sm:{track:"w-8 h-5",thumb:"w-3.5 h-3.5",translate:"translate-x-3"},md:{track:"w-10 h-6",thumb:"w-4 h-4",translate:"translate-x-4"},lg:{track:"w-12 h-7",thumb:"w-5 h-5",translate:"translate-x-5"}}[n];return r.jsxs("label",{className:`inline-flex items-center gap-3 cursor-pointer ${a?"cursor-not-allowed opacity-50":""} ${i}`,children:[r.jsxs("div",{className:"relative",children:[r.jsx("input",{ref:l,type:"checkbox",checked:e,onChange:t,disabled:a,className:"sr-only peer",...o}),r.jsx("div",{className:`
          ${c.track} rounded-full transition-colors duration-200
          peer-focus:ring-2 peer-focus:ring-primary/20 peer-focus:ring-offset-1
          ${e?"bg-primary":"bg-gray-300"}
        `,children:r.jsx("div",{className:`
            ${c.thumb} bg-white keep-white rounded-full shadow-sm
            transition-transform duration-200 absolute top-1 right-1
            ${e?`-${c.translate}`:""}
          `,style:{transform:e?"translateX(-100%)":"translateX(0)",marginRight:e?"-4px":"0"}})})]}),s&&r.jsx("span",{className:"text-sm text-gray-700 select-none",children:s})]})});x.displayName="Toggle";export{u as C,x as T};
