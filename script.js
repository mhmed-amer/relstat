(function () {
    const grid = document.getElementById('listings-grid');
    const noResults = document.getElementById('no-results');
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    let toastTimer;

    // Track which Firestore doc IDs are already rendered
    const renderedIds = new Set();
    // Track the Firestore docId for each DOM card
    const cardDocMap = new Map();

    function showToast(msg) {
        toastMsg.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
    }

    function openModal(id) { document.getElementById(id).classList.add('open'); }
    function closeModal(el) { el.classList.remove('open'); }

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.closest('.modal-overlay')));
    });
    document.querySelectorAll('.modal-overlay').forEach(ov => {
        ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(ov); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
    });

    /* ---- Firebase / Firestore ---- */
    const FIREBASE_READY = typeof firebase !== 'undefined' && typeof db !== 'undefined';

    const GRADIENTS = {
        'شقق': '#1C2B45',
        'أراضي': '#3F5D4E',
        'مخازن': '#93692B',
        'مقابر': '#5C3232'
    };
    const ICONS = {
        'شقق': '<path d="M4 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/>',
        'أراضي': '<path d="M3 21h18"/><path d="M4 21V10l4-3 4 3 4-3 4 3v11"/>',
        'مخازن': '<path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z"/><path d="M3 9l9 4 9-4"/>',
        'مقابر': '<path d="M12 3c2 2.5 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4.5 3-7z"/><path d="M6 21v-6a6 6 0 0 1 12 0v6"/>'
    };

    /* ---- Build a card DOM element from Firestore data ---- */
    function buildCard(data, docId) {
        const type = data.type || 'شقق';
        const grad = GRADIENTS[type] || GRADIENTS['شقق'];
        const icon = ICONS[type] || ICONS['شقق'];

        const mediaContent = data.images && data.images.length
            ? `<img class="uploaded-photo" src="${data.images[0]}">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="#E9E1CE" stroke-width="1.3">${icon}</svg>`;
        const mediaBgStyle = data.images && data.images.length
            ? ''
            : `style="background:linear-gradient(135deg,${grad},${grad}cc);"`;

        const card = document.createElement('div');
        card.className = 'card new-card';
        card.dataset.id = docId;
        card.dataset.cat = type;
        card.dataset.gov = data.gov || 'الإسكندرية';
        card.dataset.price = data.priceNum || 0;
        card.innerHTML = `
      <div class="card-media" ${mediaBgStyle}>
        ${mediaContent}
        <div class="verified" data-doc="${data.doc || 'أضيف بواسطة الأدمن'}"><span>موثّق</span></div>
        <div class="card-price-tag plex">${data.priceNum ? data.priceNum.toLocaleString('en-US') + ' ج.م' : 'السعر عند الاتصال'}</div>
      </div>
      <div class="card-body">
        <div class="card-title">${data.title || 'عقار بدون عنوان'}</div>
        <div class="card-loc">📍 ${data.gov || 'الإسكندرية'}</div>
        <div class="card-meta plex">
          <span>${data.area ? data.area + ' م²' : 'مساحة غير محددة'}</span>
          <span>${type}</span>
          <span>${data.images ? data.images.length + ' صورة' : '0 صورة'}</span>
        </div>
      </div>`;

        attachVerifiedListener(card.querySelector('.verified'));
        attachDeleteListener(card, docId);
        return card;
    }

    /* ---- Insert/update a card from Firestore change ---- */
    function upsertCard(docId, data) {
        if (renderedIds.has(docId)) {
            const card = grid.querySelector(`[data-id="${docId}"]`);
            if (card) {
                card.dataset.cat = data.type || 'شقق';
                card.dataset.gov = data.gov || 'الإسكندرية';
                card.dataset.price = data.priceNum || 0;
            }
            return;
        }
        renderedIds.add(docId);
        const card = buildCard(data, docId);
        cardDocMap.set(docId, card);
        grid.prepend(card);
        setTimeout(() => card.classList.remove('new-card'), 4000);
    }

    /* ---- Remove a card when deleted from Firestore ---- */
    function removeCard(docId) {
        const card = grid.querySelector(`[data-id="${docId}"]`);
        if (!card) return;
        card.classList.add('removing');
        setTimeout(() => {
            card.remove();
            renderedIds.delete(docId);
            cardDocMap.delete(docId);
            const visible = document.querySelectorAll('#listings-grid .card:not(.hidden-card)').length;
            noResults.style.display = visible === 0 ? 'block' : 'none';
        }, 290);
    }

    /* ---- Setup real-time Firestore listener ---- */
    function setupFirestore() {
        if (!FIREBASE_READY) return;

        db.collection('properties')
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        upsertCard(change.doc.id, change.doc.data());
                    } else if (change.type === 'removed') {
                        removeCard(change.doc.id);
                    }
                });
                // Reapply active filter after sync
                const activeTab = document.querySelector('.tab.active');
                if (activeTab) filterByCategory(activeTab.dataset.cat);
            }, (err) => {
                console.error('Firestore error:', err);
            });
    }

    setupFirestore();

    /* ---- Category filtering ---- */
    function setActiveTab(cat) {
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.cat === cat);
        });
    }

    function filterByCategory(cat) {
        let visible = 0;
        document.querySelectorAll('#listings-grid .card').forEach(card => {
            const match = (cat === 'all') || (card.dataset.cat === cat);
            card.classList.toggle('hidden-card', !match);
            if (match) visible++;
        });
        noResults.style.display = visible === 0 ? 'block' : 'none';
        setActiveTab(cat);
        document.querySelectorAll('.cat-card').forEach(c => {
            c.classList.toggle('active-cat', c.dataset.cat === cat);
        });
    }

    function goToListings(cat) {
        filterByCategory(cat);
        document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });
        document.getElementById('mobile-nav').classList.remove('open');
        document.getElementById('burger-btn').classList.remove('open');
    }

    document.querySelectorAll('.tab').forEach(t => {
        t.addEventListener('click', () => filterByCategory(t.dataset.cat));
    });

    document.querySelectorAll('.cat-card').forEach(c => {
        c.addEventListener('click', () => goToListings(c.dataset.cat));
    });

    document.querySelectorAll('nav.links a[data-cat], .mobile-nav a[data-cat], .foot-col a[data-cat]').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            goToListings(a.dataset.cat);
        });
    });

    document.getElementById('see-all-link').addEventListener('click', (e) => {
        e.preventDefault();
        goToListings('all');
    });

    /* ---- Footer "coming soon" links ---- */
    document.querySelectorAll('[data-soon]').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('الصفحة دي لسه تحت التجهيز — قريبًا هتكون متاحة 🛠');
        });
    });

    /* ---- Search panel ---- */
    document.getElementById('search-btn').addEventListener('click', () => {
        const type = document.getElementById('search-type').value;
        const gov = document.getElementById('search-gov').value;
        const maxPriceRaw = document.getElementById('search-price').value.replace(/[^\d]/g, '');
        const maxPrice = maxPriceRaw ? parseInt(maxPriceRaw, 10) : null;

        let visible = 0;
        document.querySelectorAll('#listings-grid .card').forEach(card => {
            let match = true;
            if (type !== 'all' && card.dataset.cat !== type) match = false;
            if (gov !== 'all' && card.dataset.gov !== gov) match = false;
            if (maxPrice && parseInt(card.dataset.price, 10) > maxPrice) match = false;
            card.classList.toggle('hidden-card', !match);
            if (match) visible++;
        });
        noResults.style.display = visible === 0 ? 'block' : 'none';
        setActiveTab(type);
        document.querySelectorAll('.cat-card').forEach(c => c.classList.toggle('active-cat', c.dataset.cat === type));
        document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });
    });

    /* ---- Mobile menu ---- */
    const burger = document.getElementById('burger-btn');
    const mobileNav = document.getElementById('mobile-nav');
    burger.addEventListener('click', () => {
        burger.classList.toggle('open');
        mobileNav.classList.toggle('open');
    });

    /* ---- Admin gating ---- */
    const ADMIN_USER = 'admin';
    const ADMIN_PASS = 'lum123';
    let isAdmin = false;
    let uploadedImages = [];

    const addBtnLabel = document.getElementById('add-btn-label');
    const mobileAddLabel = document.getElementById('mobile-add-label');
    const adminBadge = document.getElementById('admin-badge');
    const openAddBtn = document.getElementById('open-add-btn');

    function refreshAdminUI() {
        if (isAdmin) {
            addBtnLabel.textContent = 'أضف عقارك';
            mobileAddLabel.textContent = 'أضف عقارك';
            adminBadge.classList.add('show');
            openAddBtn.classList.add('brass');
            document.body.classList.add('admin-mode');
        } else {
            addBtnLabel.textContent = 'دخول الأدمن';
            mobileAddLabel.textContent = 'دخول الأدمن';
            adminBadge.classList.remove('show');
            openAddBtn.classList.remove('brass');
            document.body.classList.remove('admin-mode');
        }
    }

    function requireAdminThenOpenAdd() {
        if (isAdmin) openModal('add-modal');
        else openModal('login-modal');
    }

    document.getElementById('open-add-btn').addEventListener('click', requireAdminThenOpenAdd);
    document.getElementById('mobile-add-btn').addEventListener('click', () => {
        mobileNav.classList.remove('open');
        burger.classList.remove('open');
        requireAdminThenOpenAdd();
    });

    document.getElementById('admin-logout').addEventListener('click', () => {
        isAdmin = false;
        refreshAdminUI();
        showToast('تم تسجيل الخروج من وضع الأدمن');
    });

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('l-user').value.trim();
        const pass = document.getElementById('l-pass').value;
        const err = document.getElementById('login-error');
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            isAdmin = true;
            refreshAdminUI();
            err.style.display = 'none';
            e.target.reset();
            closeModal(document.getElementById('login-modal'));
            showToast('تم الدخول كأدمن ✓ تقدر تضيف عقارات دلوقتي');
            openModal('add-modal');
        } else {
            err.style.display = 'block';
        }
    });

    /* ---- Image upload preview ---- */
    const fileInput = document.getElementById('f-images');
    const previewRow = document.getElementById('img-preview-row');

    function renderPreviews() {
        previewRow.innerHTML = '';
        uploadedImages.forEach((src, i) => {
            const thumb = document.createElement('div');
            thumb.className = 'img-thumb';
            thumb.innerHTML = `<img src="${src}"><button type="button" class="rm" data-idx="${i}">✕</button>`;
            previewRow.appendChild(thumb);
        });
        previewRow.querySelectorAll('.rm').forEach(btn => {
            btn.addEventListener('click', () => {
                uploadedImages.splice(parseInt(btn.dataset.idx, 10), 1);
                renderPreviews();
            });
        });
    }

    fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files).slice(0, 6 - uploadedImages.length);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                uploadedImages.push(reader.result);
                renderPreviews();
            };
            reader.readAsDataURL(file);
        });
        fileInput.value = '';
    });

    /* ---- Add property -> save to Firestore ---- */
    document.getElementById('add-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isAdmin) {
            closeModal(document.getElementById('add-modal'));
            showToast('لازم تدخل كأدمن الأول عشان تضيف عقار');
            return;
        }

        const title = document.getElementById('f-title').value.trim() || 'عقار جديد بدون عنوان';
        const type = document.getElementById('f-type').value;
        const gov = document.getElementById('f-gov').value;
        const area = document.getElementById('f-area').value.trim();
        const price = document.getElementById('f-price').value.trim();
        const priceNum = parseInt(price.replace(/[^\d]/g, ''), 10) || 0;

        const submitBtn = document.getElementById('add-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري النشر...';

        try {
            if (FIREBASE_READY) {
                await db.collection('properties').add({
                    title,
                    type,
                    gov,
                    area,
                    price,
                    priceNum,
                    doc: `أضيف بواسطة الأدمن — رقم قيد مؤقت ${Math.floor(1000 + Math.random() * 9000)}/2026`,
                    images: uploadedImages,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                // Firestore onSnapshot handles adding the card to DOM on all devices
            } else {
                // No Firebase — add card locally only
                const grad = GRADIENTS[type] || GRADIENTS['شقق'];
                const icon = ICONS[type] || ICONS['شقق'];
                const card = document.createElement('div');
                card.className = 'card new-card';
                card.dataset.id = 'local-' + Date.now();
                card.dataset.cat = type;
                card.dataset.gov = gov;
                card.dataset.price = priceNum;
                card.innerHTML = `
          <div class="card-media" style="background:linear-gradient(135deg,${grad},${grad}cc);">
            <svg viewBox="0 0 24 24" fill="none" stroke="#E9E1CE" stroke-width="1.3">${icon}</svg>
            <div class="verified" data-doc="أضيف بواسطة الأدمن — رقم قيد مؤقت ${Math.floor(1000 + Math.random() * 9000)}/2026"><span>موثّق</span></div>
            <div class="card-price-tag plex">${priceNum.toLocaleString('en-US')} ج.م</div>
          </div>
          <div class="card-body">
            <div class="card-title">${title}</div>
            <div class="card-loc">📍 ${gov}</div>
            <div class="card-meta plex"><span>${area ? area + ' م²' : 'مساحة غير محددة'}</span><span>${type}</span><span>${uploadedImages.length} صورة</span></div>
          </div>`;
                grid.prepend(card);
                attachVerifiedListener(card.querySelector('.verified'));
                attachDeleteListener(card, null);
                setTimeout(() => card.classList.remove('new-card'), 4000);
                showToast('⚠️ Firebase مش مظبوط — العقار اتضاف محليًا بس');
            }

            e.target.reset();
            uploadedImages = [];
            renderPreviews();
            closeModal(document.getElementById('add-modal'));
            showToast('تم نشر العقار في السجل بنجاح ✓');
            filterByCategory('all');
            document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            console.error('Error:', err);
            showToast('حصل خطأ أثناء النشر. جرّب تاني.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'انشر العقار في لمويني';
        }
    });

    refreshAdminUI();

    /* ---- Verified seal click ---- */
    function attachVerifiedListener(el) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
            document.getElementById('verify-doc-num').textContent = el.dataset.doc || '—';
            openModal('verify-modal');
        });
    }
    document.querySelectorAll('.verified').forEach(attachVerifiedListener);

    /* ---- Delete property ---- */
    let pendingDeleteCard = null;
    let pendingDeleteDocId = null;

    function attachDeleteListener(cardEl, docId) {
        if (cardEl.querySelector('.card-delete-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'card-delete-btn';
        btn.type = 'button';
        btn.title = 'حذف العقار';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isAdmin) return;
            pendingDeleteCard = cardEl;
            pendingDeleteDocId = docId;
            const titleEl = cardEl.querySelector('.card-title');
            document.getElementById('delete-target-title').textContent = titleEl ? titleEl.textContent : 'هذا العقار';
            openModal('delete-modal');
        });
        cardEl.querySelector('.card-media').appendChild(btn);
    }

    document.querySelectorAll('#listings-grid .card').forEach(card => {
        attachDeleteListener(card, card.dataset.id || null);
    });

    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
        if (!pendingDeleteCard) return;
        const card = pendingDeleteCard;
        const docId = pendingDeleteDocId;
        closeModal(document.getElementById('delete-modal'));
        card.classList.add('removing');

        try {
            if (docId && FIREBASE_READY) {
                await db.collection('properties').doc(docId).delete();
                // onSnapshot will handle DOM removal
            } else {
                setTimeout(() => {
                    card.remove();
                    showToast('تم حذف العقار من السجل 🗑');
                    const visible = document.querySelectorAll('#listings-grid .card:not(.hidden-card)').length;
                    noResults.style.display = visible === 0 ? 'block' : 'none';
                }, 290);
            }
        } catch (err) {
            console.error('Delete error:', err);
            showToast('حصل خطأ أثناء الحذف. جرّب تاني.');
            card.classList.remove('removing');
        }

        pendingDeleteCard = null;
        pendingDeleteDocId = null;
    });

})();
