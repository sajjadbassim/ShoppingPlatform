import{r as i,j as s}from"./query-BRZwYufj.js";import{E as v}from"./eye-off-BwGW8W-Y.js";import{E as $}from"./eye-BnpBgOcs.js";import{A as z,b as E}from"./index-BOom5mBb.js";const C=i.forwardRef(({type:o="text",label:c,error:e,success:t,hint:d,icon:l,disabled:p=!1,required:u=!1,className:m="",containerClassName:f="",rows:y=4,...b},g)=>{const[n,j]=i.useState(!1),[I,x]=i.useState(!1),r=o==="password",a=o==="textarea",h=r?n?"text":"password":o,w=`
    w-full bg-white border rounded-md text-gray-800 placeholder-gray-400
    transition-all duration-200 outline-none
    focus:ring-2
    disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500
    ${e?"border-error focus:border-error focus:ring-error/20":t?"border-success focus:border-success focus:ring-success/20":"border-gray-300 focus:border-primary focus:ring-primary/20"}
    ${l?"pr-11":"pr-4"}
    ${r?"pl-11":"pl-4"}
  `,N=a?"py-3":"h-11 py-2",S=a?"textarea":"input";return s.jsxs("div",{className:`w-full ${f}`,children:[c&&s.jsxs("label",{className:"block text-sm font-medium text-gray-700 mb-1.5",children:[c,u&&s.jsx("span",{className:"text-error mr-1",children:"*"})]}),s.jsxs("div",{className:"relative",children:[l&&s.jsx("div",{className:"absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none",children:s.jsx(l,{size:20})}),s.jsx(S,{ref:g,type:a?void 0:h,disabled:p,required:u,rows:a?y:void 0,onFocus:()=>x(!0),onBlur:()=>x(!1),className:`
            ${w}
            ${N}
            ${m}
          `,...b}),r&&s.jsx("button",{type:"button",onClick:()=>j(!n),className:"absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors",tabIndex:-1,children:n?s.jsx(v,{size:20}):s.jsx($,{size:20})}),(e||t)&&!r&&s.jsx("div",{className:`absolute left-4 top-1/2 -translate-y-1/2 ${e?"text-error":"text-success"}`,children:e?s.jsx(z,{size:20}):s.jsx(E,{size:20})})]}),(d||e||t)&&s.jsx("p",{className:`mt-1.5 text-sm ${e?"text-error":t?"text-success":"text-gray-500"}`,children:e||t||d})]})});C.displayName="Input";export{C as I};
