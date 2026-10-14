import { zipSync, strToU8 } from 'fflate';
import { xmlEscape } from './core.js';

export function makeDocx(text) {
  const paragraphs = text.split(/\r\n|\n|\r/).map(line => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`).join('');
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`),
  });
}

export function exportPayload(text, format) {
  if (format === 'docx') return {data:makeDocx(text),type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
  if (!['txt','md'].includes(format)) throw new Error('Unsupported export format.');
  return {data:new TextEncoder().encode(text),type:format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'};
}

export function downloadText(text, format, filename) {
  const {data,type} = exportPayload(text,format);
  const url = URL.createObjectURL(new Blob([data],{type}));
  const a = document.createElement('a'); a.href=url; a.download=`${filename}.${format}`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
