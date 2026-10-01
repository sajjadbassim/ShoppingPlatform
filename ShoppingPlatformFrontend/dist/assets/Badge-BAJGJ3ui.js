import{j as n}from"./query-BRZwYufj.js";const w=({status:l})=>{const e=(t=>{switch(t==null?void 0:t.toUpperCase()){case"PENDING_CONFIRMATION":return{label:"بانتظار التأكيد",bg:"bg-yellow-100",text:"text-yellow-800",icon:"⏳"};case"CONFIRMED":return{label:"مؤكد",bg:"bg-blue-100",text:"text-blue-800",icon:"✓"};case"PARTIALLY_CONFIRMED":return{label:"مؤكد جزئياً",bg:"bg-cyan-100",text:"text-cyan-800",icon:"◐"};case"PREPARING":case"PROCESSING":return{label:"قيد التحضير",bg:"bg-purple-100",text:"text-purple-800",icon:"📦"};case"OUT_FOR_DELIVERY":case"SHIPPED":return{label:"في الطريق",bg:"bg-indigo-100",text:"text-indigo-800",icon:"🚚"};case"DELIVERY_FAILED":return{label:"تعذّر التسليم",bg:"bg-orange-100",text:"text-orange-800",icon:"⚠️"};case"DELIVERED":return{label:"تم التوصيل",bg:"bg-green-100",text:"text-green-800",icon:"✅"};case"CANCELLED":return{label:"ملغي",bg:"bg-red-100",text:"text-red-800",icon:"✖"};default:return{label:t||"غير معروف",bg:"bg-gray-100",text:"text-gray-800",icon:"•"}}})(l);return n.jsxs("span",{className:`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${e.bg} ${e.text}`,children:[n.jsx("span",{children:e.icon}),n.jsx("span",{children:e.label})]})},E=({src:l,alt:a,name:e,size:t="md",shape:o="circle",showStatus:g=!1,status:x="offline",className:b=""})=>{const c={xs:"w-6 h-6 text-xs",sm:"w-8 h-8 text-sm",md:"w-10 h-10 text-base",lg:"w-12 h-12 text-lg",xl:"w-16 h-16 text-xl"},u={xs:"w-1.5 h-1.5",sm:"w-2 h-2",md:"w-2.5 h-2.5",lg:"w-3 h-3",xl:"w-4 h-4"},d={online:"bg-success",offline:"bg-gray-400",busy:"bg-error",away:"bg-warning"},i={circle:"rounded-full",square:"rounded-lg"},f=s=>{if(!s)return"؟";const r=s.split(" ");return r.length>=2?`${r[0][0]}${r[1][0]}`:s[0]},h=s=>{const r=["bg-primary-light text-primary","bg-success-light text-success","bg-warning-light text-warning-dark","bg-error-light text-error","bg-info-light text-info"];if(!s)return r[0];const p=s.charCodeAt(0)%r.length;return r[p]};return n.jsxs("div",{className:`relative inline-flex ${b}`,children:[l?n.jsx("img",{src:l,alt:a||e||"Avatar",className:`
            ${c[t]}
            ${i[o]}
            object-cover
          `}):n.jsx("div",{className:`
            ${c[t]}
            ${i[o]}
            ${h(e)}
            flex items-center justify-center font-semibold
          `,children:f(e)}),g&&n.jsx("span",{className:`
            absolute bottom-0 left-0
            ${u[t]}
            ${d[x]}
            rounded-full border-2 border-white
          `})]})};export{E as A,w as S};
