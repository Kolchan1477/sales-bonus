/**
 * Функция для расчета выручки
 * @param purchase запись о покупке (один item из чека)
 * @param _product карточка товара (опционально)
 * @returns {number} выручка от продажи товара с учетом скидки
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount, sale_price, quantity } = purchase;
    // Коэффициент скидки в десятичном формате
    const discountFactor = 1 - (discount / 100);
    // Выручка = цена * количество * коэффициент скидки
    return sale_price * quantity * discountFactor;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве (начинается с 0)
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number} процент бонуса
 */
function calculateBonusByProfit(index, total, seller) {
    // Проверка на единственного продавца
    if (total === 1) {
        return seller.profit * 0.15; // 15% от прибыли
    }
    
    // 1 место (индекс 0) — 15%
    if (index === 0) {
        return seller.profit * 0.15;
    }
    
    // Последнее место — 0%
    if (index === total - 1) {
        return 0;
    }
    
    // 2 и 3 места (индексы 1 и 2) — 10%
    if (index === 1 || index === 2) {
        return seller.profit * 0.10;
    }
    
    // Все остальные — 5%
    return seller.profit * 0.05;
}

/**
 * Функция для анализа данных продаж
 * @param data объект с данными (sellers, products, purchase_records)
 * @param options объект с функциями calculateRevenue и calculateBonus
 * @returns {Array} отчет по продавцам
 */
function analyzeSalesData(data, options) {
    // ===== ШАГ 1: Проверка входных данных =====
    if (!data) {
        throw new Error('Data is required');
    }
    
    if (!data.sellers || !Array.isArray(data.sellers) || data.sellers.length === 0) {
        throw new Error('Sellers data must be a non-empty array');
    }
    
    if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
        throw new Error('Products data must be a non-empty array');
    }
    
    if (!data.purchase_records || !Array.isArray(data.purchase_records) || data.purchase_records.length === 0) {
        throw new Error('Purchase records must be a non-empty array');
    }

    // ===== ШАГ 2: Проверка наличия опций =====
    if (!options || typeof options !== 'object') {
        throw new Error('Options must be an object');
    }
    
    const { calculateRevenue, calculateBonus } = options;
    
    if (typeof calculateRevenue !== 'function') {
        throw new Error('calculateRevenue must be a function');
    }
    
    if (typeof calculateBonus !== 'function') {
        throw new Error('calculateBonus must be a function');
    }

    // ===== ШАГ 3: Подготовка промежуточных данных для сбора статистики =====
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // ===== ШАГ 4: Индексация продавцов и товаров для быстрого доступа =====
    const sellerIndex = sellerStats.reduce((result, seller) => ({
        ...result,
        [seller.id]: seller
    }), {});
    
    const productIndex = data.products.reduce((result, product) => ({
        ...result,
        [product.sku]: product
    }), {});

    // ===== ШАГ 5: Расчёт выручки и прибыли для каждого продавца =====
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        
        if (!seller) {
            console.warn(`Seller with id ${record.seller_id} not found`);
            return;
        }
        
        seller.sales_count += 1;
        seller.revenue += record.total_amount || 0;
        
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            
            if (!product) {
                console.warn(`Product with sku ${item.sku} not found`);
                return;
            }
            
            // Рассчитываем выручку
            const revenue = calculateRevenue(item, product);
            
            // Рассчитываем себестоимость
            const cost = product.purchase_price * item.quantity;
            
            // Рассчитываем прибыль
            const profit = revenue - cost;
            
            // Добавляем к общей прибыли продавца
            seller.profit += profit;
            
            // Обновляем количество проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // ===== ШАГ 6: Сортировка продавцов по прибыли =====
    sellerStats.sort((a, b) => b.profit - a.profit);

    // ===== ШАГ 7: Назначение премий =====
    const totalSellers = sellerStats.length;
    
    sellerStats.forEach((seller, index) => {
        // ВАЖНО: передаем объект продавца с полем profit
        // Если calculateBonus ожидает объект с profit, передаем seller
        // Но тесты ожидают, что calculateBonus вернет сумму бонуса
        seller.bonus = calculateBonus(index, totalSellers, seller);
        
        // Формируем топ-10 продуктов
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    // ===== ШАГ 8: Формирование результата =====
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}