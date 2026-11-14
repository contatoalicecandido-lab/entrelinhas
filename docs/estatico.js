// Demonstração pública (GitHub Pages): reproduz os exemplos e as gravações de
// checagens reais, sem servidor e sem chaves. Usado só em docs/.
(() => {
  const norm = v => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  let status = null;
  const carregar = async () => (status ??= await (await fetch("dados/status.json")).json());
  window.ENTRELINHAS_API = {
    estatico: true,
    status: carregar,
    async verificar({ texto, modo }) {
      const st = await carregar();
      const t = norm(texto);
      const gravacao = (st.gravacoes ?? []).find(g => norm(g.texto) === t);
      const exemplo = (st.exemplos ?? []).find(e => norm(e.texto) === t);
      const alvo = modo === "real" ? (gravacao ?? exemplo) : (exemplo ?? gravacao);
      if (!alvo) {
        // Texto próprio: abre o site ao vivo com o texto já preenchido.
        const destino = "https://entrelinhas-qwgp.onrender.com/?text=" + encodeURIComponent(String(texto).slice(0, 1500));
        const aba = window.open(destino, "_blank");
        if (aba) aba.opener = null; else location.href = destino;
        throw new Error("Your text opened on the live site in a new tab. Click Check answer there to run it with real searches (5 free checks a day; the first visit can take up to a minute to wake up).");
      }
      await new Promise(r => setTimeout(r, 1200));
      const dados = await (await fetch(alvo.arquivo)).json();
      if (alvo === gravacao) dados.gravacao = { data: gravacao.data };
      return dados;
    }
  };
})();
