document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('arquivoRecibo');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const fileNameDisplay = document.getElementById('fileName');
    const form = document.getElementById('reciboForm');
    const submitBtn = document.getElementById('submitBtn');
    const mensagemBox = document.getElementById('mensagem');
    const uploadTexts = document.getElementById('uploadTexts');
    const reviewModal = document.getElementById('reviewModal');
    const reviewForm = document.getElementById('reviewForm');
    const closeModalBtn = document.getElementById('closeModal');
    const cancelReviewBtn = document.getElementById('cancelReview');
    const confirmReviewBtn = document.getElementById('confirmReview');

    // Store extracted data temporarily
    let extractedData = null;
    let currentCategoria = null;
    let currentFile = null;

    // Manipula a seleção da imagem/PDF para mostrar na tela (Preview)
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;

            // Só exibe miniatura se for imagem (ignora miniatura se for PDF)
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    imagePreview.src = evt.target.result;
                    imagePreview.style.display = 'inline-block';
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else if (file.type === 'application/pdf') {
                imagePreview.style.display = 'none';
                previewContainer.style.display = 'block';
                fileNameDisplay.textContent = "📄 Documento PDF Selecionado: " + file.name;
            } else {
                imagePreview.style.display = 'none';
                previewContainer.style.display = 'none';
            }
            uploadTexts.style.display = 'none'; // Esconde os Textos bonitos de Upload
        } else {
            previewContainer.style.display = 'none';
            uploadTexts.style.display = 'block';
        }
    });

    // Modal event listeners
    closeModalBtn.addEventListener('click', closeReviewModal);
    cancelReviewBtn.addEventListener('click', closeReviewModal);

    // Close modal when clicking outside
    reviewModal.addEventListener('click', (e) => {
        if (e.target === reviewModal) {
            closeReviewModal();
        }
    });

    // Handle form submission for review
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!extractedData || !currentCategoria || !currentFile) {
            showMessage('Erro: Dados não encontrados para revisão', 'error');
            return;
        }

        // Prepare data from review form
        const reviewData = {
            data: document.getElementById('reviewData').value,
            categoria: document.getElementById('reviewCategoria').value,
            descricao: document.getElementById('reviewDescricao').value,
            valor_total: document.getElementById('reviewValor').value,
            itens_comprados: document.getElementById('reviewItens').value,
            razao_social: document.getElementById('reviewRazao').value,
            local: document.getElementById('reviewLocal').value
        };

        // Validate required fields
        if (!reviewData.data || !reviewData.categoria || !reviewData.descricao ||
            !reviewData.valor_total || !reviewData.itens_comprados ||
            !reviewData.razao_social || !reviewData.local) {
            showMessage('Por favor, preencha todos os campos obrigatórios', 'error');
            return;
        }

        try {
            showLoading(true);

            // Send confirmation request to backend
            const formData = new FormData();
            formData.append("categoria", currentCategoria);
            formData.append("documento", currentFile);
            formData.append("confirmar", "true");
            formData.append("dados_revisados", JSON.stringify(reviewData));

            const response = await fetch(`/api/recibo`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                // Success!
                const val = result.dados_extraidos.valor_total || result.dados_extraidos.Valor || "?";
                const desc = result.dados_extraidos.descricao || result.dados_extraidos.Descricao || "Recibo";

                // Exibe imagem com link pro Drive
                let driveHtml = "";
                if(result.link_foto && result.link_foto !== "Sem Link") {
                    driveHtml = `<br><a href="${result.link_foto}" target="_blank" style="color: white; text-decoration: underline;">Abrir comprovante salvo no Drive</a>`;
                }

                showMessage(`✅ <strong>Sucesso!</strong> Analisado e salvo no Drive e Planilha de ${currentCategoria}!<br>Despesa: ${desc} - R$ ${val}${driveHtml}`, 'success');

                // Limpa o form
                form.reset();
                previewContainer.style.display = 'none';
                uploadTexts.style.display = 'block';

                // Repõe o tipo selecionado antes do reset
                const savedTipo = localStorage.getItem('lastTipoDespesa') || currentCategoria;
                document.getElementById('tipoDespesa').value = savedTipo;
                const r = document.querySelector(`input[name="tipoDespesaGroup"][value="${savedTipo}"]`);
                if(r) r.checked = true;

                // Close modal and reset state
                closeReviewModal();
                resetState();
            } else {
                showMessage(`Erro do Servidor: ${result.erro}`, 'error');
            }
        } catch (err) {
            console.error(err);
            showMessage(`Falha ao comunicar com o servidor: ${err.message}`, 'error');
        } finally {
            showLoading(false);
        }
    });

    // Submissão inicial do form para extrair dados (não salva ainda)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tipoDespesa = document.getElementById('tipoDespesa').value;
        const file = fileInput.files[0];

        if(!tipoDespesa) {
            showMessage('Por favor, selecione onde salvar a despesa.', 'error');
            return;
        }
        if(!file) {
            showMessage('Por favor, anexe a foto do recibo.', 'error');
            return;
        }

        // Prepara visual de carregamento
        submitBtn.classList.add('loading');
        mensagemBox.className = 'message hidden';

        const formData = new FormData();
        formData.append("categoria", tipoDespesa);
        formData.append("documento", file);

        try {
            // Enviando a Imagem ao servidor backend Python para extração apenas
            const targetUrl = `/api/recibo?extrair_apenas=true`;
            const response = await fetch(targetUrl, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                // Store extracted data for review
                extractedData = result.dados_extraidos;
                currentCategoria = tipoDespesa;
                currentFile = file;

                // Populate review form with extracted data
                document.getElementById('reviewData').value = extractedData.data || '';
                document.getElementById('reviewCategoria').value = extractedData.categoria || '';
                document.getElementById('reviewDescricao').value = extractedData.descricao || '';
                document.getElementById('reviewValor').value = extractedData.valor_total || '';
                document.getElementById('reviewItens').value = extractedData.itens_comprados || '';
                document.getElementById('reviewRazao').value = extractedData.razao_social || '';
                document.getElementById('reviewLocal').value = extractedData.local || '';

                // Show review modal
                showReviewModal();

            } else {
                showMessage(`Erro do Servidor: ${result.erro}`, 'error');
            }
        } catch (err) {
            console.error(err);
            showMessage(`Falha ao comunicar com o servidor: ${err.message}`, 'error');
        } finally {
            submitBtn.classList.remove('loading');
        }
    });

    // Helper functions
    function showReviewModal() {
        reviewModal.classList.remove('hidden');
        // Prevent scrolling behind modal
        document.body.style.overflow = 'hidden';
    }

    function closeReviewModal() {
        reviewModal.classList.add('hidden');
        document.body.style.overflow = '';
        resetState();
    }

    function resetState() {
        extractedData = null;
        currentCategoria = null;
        currentFile = null;
        // Clear review form
        if (reviewForm) {
            reviewForm.reset();
        }
    }

    function showLoading(isLoading) {
        if (isLoading) {
            submitBtn.classList.add('loading');
        } else {
            submitBtn.classList.remove('loading');
        }
    }

    function showMessage(message, type) {
        mensagemBox.innerHTML = message;
        mensagemBox.className = `message ${type}`;
        mensagemBox.classList.remove('hidden');

        // Auto-hide after 8 seconds
        setTimeout(() => {
            mensagemBox.classList.add('hidden');
        }, 8000);
    }
});
