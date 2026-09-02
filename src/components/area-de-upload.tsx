"use client";

import { useRef, useState } from "react";

import { IconAnexo, IconClose, IconUpload } from "@/components/icons";

/**
 * Área de envio de arquivo — a caixa tracejada com o ícone no círculo.
 *
 * Substitui o `<input type="file">` cru e o rótulo miudinho "Anexar arquivo", que não deixavam
 * claro onde clicar nem que dá pra arrastar o arquivo pra dentro. Aqui a área inteira é o alvo:
 * clicar abre o seletor, arrastar por cima destaca a borda, soltar envia.
 *
 * O limite de tamanho é conferido ANTES de ler o arquivo. Sem isso, um arquivo grande demais só
 * falharia lá no fim do envio, depois de o usuário esperar — e a mensagem de erro chegaria sem
 * relação visível com o que ele fez.
 */
export function AreaDeUpload({
  aoEscolher,
  accept,
  limiteMb = 4,
  titulo = "Enviar um arquivo",
  nomeDoArquivo,
  aoRemover,
  disabled,
  className,
}: {
  aoEscolher: (arquivo: File) => void;
  /** Mesmo formato do `accept` do input nativo (ex.: "image/*"). */
  accept?: string;
  limiteMb?: number;
  titulo?: string;
  /** Quando preenchido, a caixa mostra o arquivo já escolhido no lugar do convite. */
  nomeDoArquivo?: string;
  aoRemover?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const entradaRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState("");

  function receber(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.size > limiteMb * 1024 * 1024) {
      setErro(`O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB — o limite é ${limiteMb} MB.`);
      return;
    }
    setErro("");
    aoEscolher(arquivo);
  }

  if (nomeDoArquivo) {
    return (
      <div className={`upload-area upload-area-preenchida${className ? ` ${className}` : ""}`}>
        <span className="upload-area-arquivo">
          <IconAnexo width={14} height={14} />
          {nomeDoArquivo}
        </span>
        {aoRemover && !disabled ? (
          <button type="button" className="upload-area-remover" onClick={aoRemover} aria-label="Remover arquivo">
            <IconClose width={12} height={12} />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        className={`upload-area${arrastando ? " arrastando" : ""}`}
        onClick={() => entradaRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          if (!disabled) receber(e.dataTransfer.files?.[0]);
        }}
      >
        <span className="upload-area-icone">
          <IconUpload width={16} height={16} />
        </span>
        <strong>{titulo}</strong>
        <span className="upload-area-dica">
          ou <b>clique para escolher</b> ({limiteMb} MB no máximo)
        </span>
      </button>

      {erro ? <p className="upload-area-erro">{erro}</p> : null}

      <input
        ref={entradaRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          receber(e.target.files?.[0]);
          // Zera pra que escolher o MESMO arquivo de novo (depois de remover) dispare `change`.
          e.target.value = "";
        }}
      />
    </div>
  );
}
