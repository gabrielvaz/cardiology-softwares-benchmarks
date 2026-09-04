# CardioBench: design

Data: 2026-09-04
Repo: `gabrielvaz/cardiology-softwares-benchmarks`
Status: aguardando revisão

## 1. Objetivo

Transformar o acervo bruto deste repositório (124 PDFs de manuais e 167 estudos
do PubMed) em um repositório web público de benchmark de software de cardiologia,
com três áreas: catálogo de padrões de tela, biblioteca de manuais e base
quantitativa de estudos de usabilidade.

O acervo existe hoje sem navegação: um `index.html` de 669 linhas com lista de
arquivos hardcoded e um `rootPath` absoluto quebrado
(`/Users/gabriel.vaz/dev-apps/cardioline-manuals-and-ux-studies/`). Ele será
substituído.

## 2. Decisões travadas

Definidas em conversa em 2026-09-04:

| Decisão | Escolha |
|---|---|
| Audiência e hospedagem | Público, com PDFs e screenshots servidos |
| Nome do site | CardioBench (definido em 2026-09-04, durante a fase 1) |
| Idioma da interface | Inglês |
| Entrada de telas na galeria | Automática, com LLM filtrando o que não é interface |
| Executor da classificação | Subagents do Claude Code com Sonnet 5. Nenhuma API externa, nenhuma chave |
| Unidade do catálogo | Produto único com multi-tag (sem módulos filhos) |
| Home do site | Catálogo de padrões de tela (modelo aiuxplayground) |
| Página do padrão | Galeria agrupada por produto, com resumo curto e legendas |
| Área de estudos | Base quantitativa de usabilidade |
| Hospedagem dos PDFs | CDN jsDelivr sobre o repo público |
| Primeira fase | Saneamento do acervo |

O risco de copyright de publicar manuais proprietários de 33 fabricantes num
domínio ligado à Cardios, concorrente de vários deles, foi levantado e a decisão
de publicar de todo modo é do Gabriel.

## 3. Inventário medido

Medições feitas sobre o commit `38db820`.

Acervo no repo:

- 200 arquivos `.pdf` no repo, dos quais apenas **103 são PDFs de verdade**.
  Os outros 97 são páginas HTML, respostas 401, "Not found" ou arquivos vazios
  salvos com extensão `.pdf`. Ver 3.3, isto foi medido durante a execução e
  contradiz a estimativa inicial de 5 ilegíveis. Os 5 casos mais evidentes eram: `alivecor/AliveCor-KardiaMobile-6L-user-manual.pdf`,
  `biocare/Biocare-iE-6-6-lead-ECG-machine-user-manual.pdf`,
  `bpl-medical/BPL-Cardiart-9108D-brochure.pdf`, `eko/Eko-DUO-Manual.pdf`,
  `midmark/Midmark-IQecg-manual.pdf`
- 12.608 páginas somadas, contando apenas os PDFs reais
- 539 MB de blobs, maior arquivo com 22,8 MB, nenhum acima de 50 MB
- 167 estudos em markdown: `ux-study/` (71), `human-factors/` (28),
  `workflow/` (27), `education/` (26), `benchmark/` (8), `research/` (7)
- `ecg-screenshots/` contém 1 arquivo, e é um PDF, não uma imagem
- `manual/` tem 8 PDFs que duplicam parcialmente `ecg-manuals/`
- `vendor/js/` traz pdf.js e marked, dependências do `index.html` atual

Acervo externo a importar, hoje em `/Volumes/mac-mini-1tb/dev-apps/cardioline/_pesquisa/`:

- 61 PDFs, dos quais 56 reais e 47 ainda ausentes do repo, incluindo os de
  software de estação: Spacelabs
  Sentinel, Schiller SEMA, Amedtec ECGpro, Cardiolex EC-Store, Meditech PC-ECG,
  Norav, Baxter Epiphany Cardio Server, GE MUSE NX
- 63 screenshots PNG já capturados, de 5 apps mobile (`pmcardio`,
  `ecg_academy`, `dr_ecg`, `kardiastation`, `spandan_ecg`), com `description.md`
- 9 documentos de análise competitiva e um levantamento de cerca de 40 produtos

### 3.1 Extração de figuras: viabilidade medida

Extrair imagens embutidas cruas não funciona neste acervo. `Marquette-MAC-15`
tem 362 imagens em 362 páginas, porque cada página é um scan inteiro.
`Quinton-Q-Stress-4.5` tem 50.592 imagens em 248 páginas, porque as figuras
estão fatiadas em tiles.

O que funciona é `page.get_image_info()`, que devolve o bbox de cada figura em
coordenadas de página, permitindo recorte determinístico. Aplicando o filtro
`8% <= área da figura / área da página <= 85%`, com proporção entre 0,25 e 4,0 e
largura mínima de 150pt:

- **2.857 figuras recortáveis** nos 103 PDFs reais
- **1.753 páginas escaneadas inteiras** (figura acima de 85% da página),
  concentradas em 8 PDFs: Burdick E350i e Eclipse, Cardioline Delta 1 Plus,
  Marquette MAC 12/15 e MAC PC, Nihon Kohden ECG-9320 e os diagramas de circuito
  da Siemens

O piso de 8% elimina logos de cabeçalho e rodapé sem custo. O teto de 85%
separa scan de página inteira, que precisa de tratamento diferente.

Os PDFs com mais figuras recortáveis são: Quinton Q-Stress 4.5 (303),
HP PageWriter XL service (280), Philips Tempus Pro (130), Philips PageWriter
Touch service (117), corpuls3 v4.2 (103), Bionet Cardio7 (100), GE CASE v6-7
(100), GE CardioSoft (99), Philips PageWriter TC20 (97), PageWriter TC70 (95).

Validação visual em duas amostras confirmou que o bbox recortado corresponde
exatamente à captura de tela, e que o resto da página é texto. Em
`Cardioline-touchECG` página 59 a figura tem 24,2% da página; em
`Bionet-Cardio7` página 113 tem 18,6%. O único outro item detectado em ambas é
o logo do cabeçalho, abaixo de 2%.

### 3.2 Legendas de figura

Manuais editorados trazem legenda em itálico abaixo da figura, por exemplo
"*Examination preview window with Full user interface*" no touchECG. Quando ela
existe, o texto do PDF já descreve a tela. Isso serve como sinal de
classificação e como legenda pronta, reduzindo o que o subagent precisa inferir.
Quando não existe, o parágrafo imediatamente acima da figura costuma descrever
a ação, como no Cardio7 ("Select 'ON' when applying 'EMG' filter").

O pipeline extrai ambos os contextos textuais e os passa ao subagent junto com
a imagem.

## 4. Arquitetura

Monorepo dentro do repositório atual. Sem banco de dados.

```
web/            Next.js (App Router) + TypeScript + Tailwind, saída estática
pipeline/       Python: recorte, orquestração de subagents, build de dados
data/           JSON versionado no git, fonte de verdade do site
screens/        recortes WebP das telas
ecg-manuals/    intocado
ux-study/ …     intocado
docs/           este spec e o plano de implementação
```

Sem banco porque o acervo é read-only e só muda quando o pipeline roda.
Versionar o JSON no git dá um ganho concreto: cada rodada do pipeline vira um
diff revisável, então a classificação do LLM pode ser inspecionada com
`git diff` antes de publicar. É o gate humano opcional, de graça.

O site é gerado estaticamente. Os filtros rodam no cliente, com o estado das
facetas serializado na URL para que qualquer combinação de filtro seja
compartilhável.

### 4.1 Servir os assets

Os PDFs ficam no repositório e são lidos via jsDelivr
(`cdn.jsdelivr.net/gh/gabrielvaz/cardiology-softwares-benchmarks@main/...`),
mantendo o build do site magro. Isso exige que o repositório seja público.

Dois arquivos passam do limite de 20 MB do jsDelivr:
`mortara/Mortara-ELI-150c-250c-manual-alt.pdf` (22,8 MB) e
`ge-healthcare/Marquette-MAC-PC-ECG-service-manual.pdf` (20,5 MB). Tratamento:
servir esses arquivos via
`raw.githubusercontent.com` como exceção registrada nos dados, campo
`cdn: "raw"` no registro do manual.

Os recortes WebP também são servidos pelo jsDelivr, e não entram no build.

## 5. Taxonomia

"Tipo de software" não é uma dimensão única. São três facetas ortogonais, mais
os eixos simples.

**Faceta A, modalidade clínica** (multi-valor): `resting-ecg`, `holter`,
`abpm`, `stress-test`, `telemetry`, `spirometry`, `ai-analysis`, `education`,
`cardiac-rehab`.

**Faceta B, arquitetura e entrega**: `embedded-firmware`, `desktop-client`,
`server-management`, `webapp`, `saas-cloud`, `mobile-app`, `wearable`.

**Faceta C, função no fluxo**: `acquisition`, `review-analysis`,
`reporting-signing`, `management-worklist`, `distribution-integration`,
`telemedicine`, `education`.

Eixos simples: fabricante, mercado, plataforma, ano ou versão, idioma da
captura, fonte (manual PDF ou captura web).

**Tipos de tela** (18, a dimensão principal de filtro e a unidade da home):
`login-auth`, `worklist`, `patient-registration`, `live-acquisition`,
`ecg-viewer`, `measurements-interpretation`, `report-editor`, `report-output`,
`holter-analysis`, `stress-test`, `settings`, `user-management`,
`connectivity-integration`, `dashboard-home`, `search-filters`, `error-alert`,
`onboarding-wizard`, `calibration-leads`.

### 5.1 Nota sobre firmware embarcado

Na conversa foram marcadas as categorias de produto desktop, webapp e mobile,
sem firmware embarcado. Mas o acervo é majoritariamente firmware, e vários dos
PDFs mais ricos em figuras são de aparelho (Philips PageWriter, Bionet Cardio7,
corpuls3, Nihon Kohden). Excluir firmware esvaziaria a galeria.

Decisão adotada: `embedded-firmware` permanece na faceta B e as telas são
coletadas, porque a exclusão é reversível por filtro e a coleta não é. O filtro
padrão da home pode desmarcar firmware, se preferir. Este ponto merece
confirmação na revisão.

## 6. Modelo de dados

Cinco arquivos em `data/`, todos JSON.

**`products.json`**: `id`, `name`, `vendor`, `vendor_slug`, `modalities[]`,
`architectures[]`, `functions[]`, `markets[]`, `website`, `manual_ids[]`,
`screen_count`, `notes`.

**`screens.json`**: `id`, `product_id`, `pattern`, `modalities[]`, `image`,
`caption`, `confidence`, `lang`, e `source`, que é
`{type: "manual", manual_id, page, bbox}` ou
`{type: "web", url, captured_at}`.

**`patterns.json`**: `slug`, `name`, `function_group`, `description`,
`screen_count`. As telas não são duplicadas aqui, a associação vive em
`screens.json`.

**`manuals.json`**: `id`, `product_id`, `title`, `path`, `cdn`, `pages`,
`lang`, `doc_type` (user, service, quick-guide, brochure).

**`studies.json`**: `id`, `pmid`, `doi`, `title`, `year`, `venue`, `design`,
`n`, `sus_score`, `task_time`, `error_rate`, `devices[]`, `metric`, `result`,
`has_quantitative_data`, `source_file`.

Como um produto é único e multi-tag, a granularidade por modalidade é
preservada nas tags da própria tela: `screens[].modalities` permite filtrar
"todas as telas de laudo de MAPA" mesmo dentro de uma suíte como o BTL
CardioPoint, que carrega cinco modalidades.

## 7. Pipeline

Cinco estágios, cada um retomável, com estado em disco em
`pipeline/state/<pdf-id>.json`. Nenhuma chamada a API externa: a classificação
é feita por subagents do Claude Code com Sonnet 5, lendo as imagens recortadas.

**Estágio 1, recorte (`pipeline/01_crop.py`)**
Para cada PDF, `get_image_info()` dá os bboxes. Aplica o filtro de área,
proporção e largura, recorta em PNG a 150 dpi, e coleta os dois contextos
textuais (legenda em itálico abaixo, parágrafo acima). Saída: PNGs em
`pipeline/candidates/<pdf-id>/` e um manifest JSON por PDF. Determinístico,
local, sem custo. Volume esperado: 2.827 recortes.

**Estágio 2, classificação por subagents (`pipeline/02_classify.py` gera os lotes)**
Lotes de 25 recortes. Cada subagent recebe as imagens, os contextos textuais, a
lista de 18 tipos de tela e a ficha do produto, e devolve JSON por recorte com:
`is_ui_screenshot` (booleano, o filtro de sujeira contra diagrama de eletrodo,
foto de cabo, gráfico de traçado impresso, página de aviso legal), `pattern`,
`modalities[]`, `caption`, `confidence`. Os reprovados ficam registrados no
estado com o motivo, para auditoria, e não entram em `data/`.

**Estágio 3, escaneados (fora da fase 1)**
Os 8 PDFs de página escaneada precisam de outra rota: renderizar a página
inteira e deixar o subagent localizar a região. Valor baixo, custo alto, fica
para depois.

**Estágio 4, estudos (`pipeline/04_studies.py`)**
Lotes de abstracts para subagents, extraindo os campos quantitativos de
`studies.json`. Estudos sem métrica nenhuma recebem
`has_quantitative_data: false`, o que na prática filtra os irrelevantes do
acervo (camundongo, hidrogel injetável, apneia do sono) sem trabalho extra e
sem excluir nada do repositório.

**Estágio 5, build (`pipeline/05_build.py`)**
Consolida os manifests em `data/*.json`, converte os PNGs aprovados em WebP
otimizado para `screens/`, e recalcula as contagens de `patterns.json` e
`products.json`.

### 7.1 Escala

2.827 recortes em lotes de 25 são cerca de 113 subagents. Isso não cabe em uma
sessão. O pipeline é retomável por PDF, então cada sessão avança um conjunto de
manuais e o `git diff` mostra o que entrou. A ordem de processamento prioriza
software de estação e webapp, que é o comparativo relevante, deixando firmware
de aparelho para as rodadas seguintes.

## 8. Áreas do site

**`/` Patterns (home)**: os 18 tipos de tela como cards, agrupados pela faceta
C (função no fluxo), com contagem de telas e de produtos. Chips de filtro no
topo, sem sidebar.

**`/patterns/[slug]`**: resumo curto do padrão, depois todas as telas agrupadas
por produto, com a legenda de cada uma e link para a página exata do manual de
origem. Clique amplia a tela e mostra a procedência completa.

**`/products` e `/products/[id]`**: índice filtrável pelas três facetas e ficha
por produto com telas, manuais e estudos relacionados.

**`/manuals`**: biblioteca dos PDFs com viewer, substituindo o `index.html`.
Filtro por fabricante, produto, tipo de documento e idioma.

**`/studies`**: tabela ordenável da base quantitativa, com gráfico comparativo
de SUS entre dispositivos, filtros por ano, desenho e modalidade, e ficha por
estudo com DOI e abstract.

## 9. Saneamento (fase 1)

1. Remover os 5 PDFs ilegíveis. Verificar os 18 PDFs restantes abaixo de 20 KB
   (são 23 no total nessa faixa de tamanho, menos os 5 já identificados como
   ilegíveis), que provavelmente abrem mas contêm apenas uma página de erro
2. Deduplicar `manual/` contra `ecg-manuals/`, mantendo `ecg-manuals/` como
   canônico
3. Importar os 134 PDFs de `_pesquisa/`, priorizando os de software de estação,
   na convenção `ecg-manuals/<vendor-slug>/`
4. Importar os 63 screenshots existentes para `screens/`, com registro em
   `screens.json` e `source.type: "web"`
5. Montar `products.json` inicial a partir do levantamento de cerca de 40
   produtos em `_pesquisa/`
6. Remover `index.html`, `vendor/js/`, `pubmed_results*.xml`, `Makefile`
7. Adicionar `.superpowers/` e artefatos do pipeline ao `.gitignore`
8. Reescrever o `README.md`, que hoje descreve uma estrutura de diretórios
   (`/specs/`) que não existe
9. Tornar o repositório público

## 10. Fases

| Fase | Entrega |
|---|---|
| 1 | Saneamento do acervo e `products.json` inicial |
| 2 | Pipeline estágio 1 (recorte) e estágio 2 (classificação) num recorte de 10 PDFs de software de estação |
| 3 | Site Next.js com as quatro áreas, sobre os dados reais das fases 1 e 2 |
| 4 | Estágio 4 (estudos) e a área `/studies` |
| 5 | Rodadas de classificação do resto do acervo |
| 6 | Publicação: repo público, deploy, jsDelivr |

## 11. Riscos

**Copyright.** Publicar manuais proprietários de 33 fabricantes num domínio
ligado à Cardios é o risco material do projeto. Decisão tomada com o risco
declarado. Mitigação disponível se necessário: manter o site público e os PDFs
atrás de link para a fonte original do fabricante, sem servir o arquivo.

**Classificação sem revisão humana.** Sem gate de aprovação, uma tela mal
classificada é publicada. Mitigações: o filtro determinístico de área elimina a
maior parte da sujeira antes do LLM; `is_ui_screenshot` é a segunda barreira;
`confidence` fica registrado e o site pode ocultar o que estiver abaixo de um
limiar; e o `git diff` de cada rodada permite auditoria sem bloquear o fluxo.

**Legenda gerada pode errar.** A legenda vem do texto do próprio manual quando
existe, e só é inferida quando não existe. Cada tela linka para a página exata
do PDF, então o leitor pode verificar a fonte.

**Ausência não é evidência.** A matriz de atributos produto por recurso foi
deliberadamente deixada fora do escopo, porque um recurso ausente no manual não
prova ausência no produto, e publicar isso sobre concorrentes é um erro que
volta.

**Firmware fora da taxonomia declarada.** Ver 5.1. Coletar e filtrar, em vez de
excluir.

## 12. Registro de execução da fase 1

Executada em 2026-09-04, na branch `phase-1-sanitize`. O que a execução
desmentiu do inventário estimado:

**Os PDFs quebrados eram 97, não 5.** O primeiro diagnóstico usou o PyMuPDF
como juiz e ele abriu 119 de 124 arquivos, o que pareceu bom. Mas o MuPDF
renderiza HTML como documento: ele estava abrindo as páginas de erro como PDFs
de uma página com texto. O critério correto é o magic number `%PDF`. Dos 200
arquivos `.pdf` do repositório original, 103 eram PDFs e 97 eram lixo de
download. Todos os 97 foram removidos.

**Perda relevante nessa remoção:** `BTL-CardioPoint-Manual.pdf` era uma página
HTML de 336 bytes. O CardioPoint é uma das suítes de estação mais relevantes
para comparação e agora não tem manual no acervo. Recoletar é trabalho de outra
fase.

**Os 63 screenshots existentes são thumbnails de 166x296 pixels**, capturas de
listagem de app store. Foram importados porque não custam nada, mas são
inúteis numa galeria: precisam de recaptura em resolução cheia. Registrados em
`data/screens.seed.json` com essa ressalva.

**`_pesquisa/` tem 61 PDFs, não 134.** O número 134 era o total do projeto
`cardioline` inteiro, incluindo `_referencias/` e `_acervo/`. Dos 61, 56 são
reais e 47 não estavam no repo. Todos os 47 foram importados e renomeados na
convenção `<Vendor>-<Product>-<doc-type>[-lang].pdf`.

**Vários dos softwares de estação esperados são brochures, não manuais.**
Spacelabs Sentinel tem 6 e 3 páginas, Schiller SEMA tem 4 e 5, Cardiolex
EC-Store tem 3 e 4. Vão render pouca tela extraível. Os manuais substanciais de
software que entraram são Meditech PCS 5.67 (38 páginas) e Meditech EKG6012
(76 páginas).

**Acervo após o saneamento:** 129 manuais reais, 13.878 páginas, 33
fabricantes, em 100 arquivos em inglês, 14 em português, 1 em francês e 14 não
detectados.

**Taxa de legenda medida:** no `Cardioline-touchECG-user-manual`, 36 dos 38
recortes vieram com legenda do próprio manual, 91%. Isso confirma a hipótese de
3.2: a descrição da tela vem do texto do fabricante na maioria dos casos, não
do modelo.

**O que o filtro geométrico não separa, e nem deveria:** na página 40 do mesmo
manual, os dois recortes são diagramas de posicionamento de eletrodo, e a
"legenda" capturada é body copy sobre a quinta costela. É exatamente a sujeira
que `is_ui_screenshot` existe para barrar. A geometria acha figuras; distinguir
interface de diagrama é trabalho do classificador.
