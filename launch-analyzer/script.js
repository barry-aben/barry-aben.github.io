document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const launchUrlInput = document.getElementById('launchUrl');
    const companyIdInput = document.getElementById('companyId');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    
    // Store data elements and references globally
    let dataElementsList = [];
    let dataElementReferences = {};
    
    analyzeBtn.addEventListener('click', function() {
        const launchUrl = launchUrlInput.value.trim();
        
        if (!launchUrl) {
            showStatus('Please enter a valid Adobe Launch library URL.', 'error');
            return;
        }
        
        // Start analysis
        analyzeLibrary(launchUrl);
    });
    
    function analyzeLibrary(url) {
        // Reset and show status
        resultsDiv.style.display = 'none';
        showStatus('Loading and analyzing Adobe Launch library...', 'loading');
        
        // Reset global variables
        dataElementsList = [];
        dataElementReferences = {};
        
        // Create a script element to load the Launch library
        const script = document.createElement('script');
        script.src = url;
        script.onload = function() {
            // Give the library time to initialize
            setTimeout(function() {
                try {
                    // Check if _satellite object exists
                    if (typeof _satellite === 'undefined') {
                        showStatus('Could not find _satellite object. Make sure the URL is a valid Adobe Launch library.', 'error');
                        return;
                    }
                    
                    // Extract and display information
                    extractLibraryInfo();
                    extractExtensions();
                    
                    // Extract rules first to collect references
                    extractRules();
                    // Scan extensions for references
                    scanExtensionsForDataElements();
                    
                    // Scan data elements for custom code and references
                    scanDataElementsForCustomCode();
                    
                    // Now extract data elements with reference information
                    extractDataElements();
                    
                    // Show raw satellite object
                    showSatelliteObject();
                    
                    // Show results and update status
                    resultsDiv.style.display = 'block';
                    showStatus('Analysis complete!', 'success');
                    
                    // Smooth scroll to results
                    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
                } catch (error) {
                    showStatus('Error analyzing the library: ' + error.message, 'error');
                    console.error(error);
                }
            }, 1000); // Wait 1 second for library to initialize
        };
        
        script.onerror = function() {
            showStatus('Error loading the Adobe Launch library. Check the URL and try again.', 'error');
        };
        
        document.head.appendChild(script);
    }
    
    function extractLibraryInfo() {
        const libraryInfoDiv = document.getElementById('libraryInfo');
        let html = '<div class="table-container"><table>';
        
        // Get basic library info
        const buildInfo = _satellite.buildInfo || {};
        const environment = _satellite.environment || {};
        
        // Get property info
        const propertyInfo = _satellite.property || {};
        
        // Get company ID from input
        const companyId = companyIdInput.value.trim() || 'Not specified';
        
        // Create property link (if we have company ID and property ID)
        let propertyLink = '';
        const propertyId = propertyInfo.id || '';
        
        if (companyId !== 'Not specified' && propertyId) {
            
            const launchUrl = `https://experience.adobe.com/#data-collection/tags/companies/${companyId}/properties/${propertyId}/overview`;
            propertyLink = ` <a href="${launchUrl}" target="_blank" title="Open in Adobe Launch" class="launch-link">📝</a>`;
        }
        
        html += `<tr><td><strong>Company ID</strong></td><td>${companyId}</td></tr>`;
        html += `<tr><td><strong>Property ID</strong></td><td>${propertyId}${propertyLink}</td></tr>`;
        html += `<tr><td><strong>Property Name</strong></td><td>${propertyInfo.name || 'Unknown'}</td></tr>`;
        html += `<tr><td><strong>Library Name</strong></td><td>${buildInfo.name || 'Unknown'}</td></tr>`;
        html += `<tr><td><strong>Library Version</strong></td><td>${buildInfo.version || 'Unknown'}</td></tr>`;
        html += `<tr><td><strong>Build Date</strong></td><td>${buildInfo.buildDate || 'Unknown'}</td></tr>`;
        html += `<tr><td><strong>Environment</strong></td><td>${environment.stage || 'Unknown'}</td></tr>`;
        
        html += '</table></div>';
        
        // Add CSS for the link
        html += `
        <style>
        .launch-link {
            display: inline-block;
            margin-left: 8px;
            text-decoration: none;
            font-size: 16px;
            color: #e34850;
            transition: all 0.2s;
        }
        .launch-link:hover {
            transform: scale(1.2);
            color: #c73b42;
        }
        </style>
        `;
        
        libraryInfoDiv.innerHTML = html;
    }
    
    function extractExtensions() {
        const extensionsDiv = document.getElementById('extensionsInfo');
        
        try {
            // Try to find extensions in different ways
            let extensions = [];
            let extensionDetails = {};
            
            // Method 1: Try to get from _satellite.extensionConfiguration
            if (_satellite.extensionConfiguration) {
                extensions = Object.keys(_satellite.extensionConfiguration);
                extensionDetails = _satellite.extensionConfiguration;
            }
            // Method 2: Try to infer from property settings
            else if (_satellite.property && _satellite.property.settings && _satellite.property.settings.extensions) {
                extensions = Object.keys(_satellite.property.settings.extensions);
                extensionDetails = _satellite.property.settings.extensions;
            }
            // Method 3: Look for extension modules
            else if (_satellite._container && _satellite._container.extensions) {
                extensions = Object.keys(_satellite._container.extensions);
                extensionDetails = _satellite._container.extensions;
            }
            
            if (extensions.length > 0) {
                let html = `<p>Found ${extensions.length} extensions:</p>`;
                html += '<div class="table-container"><table class="sortable-table">';
                html += '<thead><tr><th>Extension Name</th><th>Version</th></tr></thead><tbody>';
                
                extensions.forEach(extension => {
                    const details = extensionDetails[extension] || {};
                    const version = details.version || details.settings?.version || 'Unknown';
                    
                    html += `<tr><td>${extension}</td><td>${version}</td></tr>`;
                });
                
                html += '</tbody></table></div>';
                extensionsDiv.innerHTML = html;
                
                // Add sorting functionality
                const table = extensionsDiv.querySelector('table');
                addSortingToTable(table);
            } else {
                extensionsDiv.innerHTML = '<p>No extensions could be directly identified. Check the raw _satellite object for more details.</p>';
            }
        } catch (error) {
            extensionsDiv.innerHTML = `<p>Error extracting extensions: ${error.message}</p>`;
            console.error('Error extracting extensions:', error);
        }
    }
    
    function extractDataElements() {
        const dataElementsDiv = document.getElementById('dataElements');
        
        try {
            // Try different ways to extract data elements
            let dataElements = [];
            let dataElementDetails = {};
            
            // Method 1: Check property.settings.dataElements
            if (_satellite.property && 
                _satellite.property.settings && 
                _satellite.property.settings.dataElements) {
                dataElements = Object.keys(_satellite.property.settings.dataElements);
                dataElementDetails = _satellite.property.settings.dataElements;
            }
            // Method 2: Try to use internal container
            else if (_satellite._container && 
                     _satellite._container.dataElements) {
                dataElements = Object.keys(_satellite._container.dataElements);
                dataElementDetails = _satellite._container.dataElements;
            }
            
            // Store data elements globally for reference analysis
            dataElementsList = dataElements;
            
            if (dataElements.length > 0) {
                let html = `<p>Found ${dataElements.length} data elements:</p>`;
                html += '<div class="table-container"><table class="sortable-table">';
                html += '<thead><tr><th>Data Element Name</th><th>Type</th><th>Default Value</th><th>References</th></tr></thead><tbody>';
                
                dataElements.forEach(name => {
                    let type = 'Unknown';
                    let defaultValue = '';
                    let isCustomCode = false;
                    
                    // Try to get the details from different locations
                    try {
                        const details = dataElementDetails[name] || {};
                        
                        if (details.type) {
                            type = details.type;
                            // Check if this is a custom code data element
                            if (details.type === 'javascript' || 
                                details.type === 'custom_code' || 
                                (details.modulePath && details.modulePath.includes('custom-code'))) {
                                isCustomCode = true;
                            }
                        } else if (details.modulePath) {
                            type = details.modulePath.split('/').pop();
                            if (details.modulePath.includes('custom-code')) {
                                isCustomCode = true;
                            }
                        } else if (details.cleanText) {
                            type = details.cleanText;
                        }
                        
                        // Try to get default value
                        if (details.defaultValue !== undefined) {
                            defaultValue = typeof details.defaultValue === 'string'
                                ? escapeHtml(details.defaultValue) 
                                : escapeHtml(JSON.stringify(details.defaultValue));
                        } else if (details.settings && details.settings.defaultValue !== undefined) {
                            defaultValue = typeof details.settings.defaultValue === 'string'
                                ? escapeHtml(details.settings.defaultValue)
                                : escapeHtml(JSON.stringify(details.settings.defaultValue));
                        }
                        
                        // Add custom code badge to type if needed
                        if (isCustomCode) {
                            type += ' <span class="custom-code-badge">Custom Code</span>';
                        }
                    } catch (error) {
                        console.error(`Error processing data element ${name}:`, error);
                    }
                    
                    // Calculate the references count
                    const references = dataElementReferences[name] || [];
                    const refCount = references.length;
                    
                    // Generate references HTML
                    let referencesHtml = '';
                    if (refCount > 0) {
                        referencesHtml = `<div><span class="badge">${refCount}</span> references</div>`;
                        referencesHtml += `<div class="collapsible-content">`;
                        
                        // Group references by type
                        const ruleEventRefs = references.filter(ref => ref.type === 'rule' && ref.context === 'Event');
                        const ruleConditionRefs = references.filter(ref => ref.type === 'rule' && ref.context === 'Condition');
                        const ruleActionRefs = references.filter(ref => ref.type === 'rule' && ref.context === 'Action');
                        const dataElementRefs = references.filter(ref => ref.type === 'dataElement');
                        const customCodeRefs = references.filter(ref => ref.type === 'customCode');
                        const extensionRefs = references.filter(ref => ref.type === 'extension');
                        
                        // Rule Event references
                        if (ruleEventRefs.length > 0) {
                            referencesHtml += `<div class="reference-section">
                                <div class="reference-category">Rule Events (${ruleEventRefs.length}):</div>
                                <ul class="references-list">`;
                            
                            ruleEventRefs.forEach(ref => {
                                let badge = '';
                                if (ref.isCustomCode) {
                                    badge = ' <span class="custom-code-badge">Custom Code</span>';
                                }
                                referencesHtml += `<li>${ref.name}${badge}</li>`;
                            });
                            
                            referencesHtml += `</ul></div>`;
                        }
                        
                        // Rule Condition references
                        if (ruleConditionRefs.length > 0) {
                            referencesHtml += `<div class="reference-section">
                                <div class="reference-category">Rule Conditions (${ruleConditionRefs.length}):</div>
                                <ul class="references-list">`;
                            
                            ruleConditionRefs.forEach(ref => {
                                let badge = '';
                                if (ref.isCustomCode) {
                                    badge = ' <span class="custom-code-badge">Custom Code</span>';
                                }
                                referencesHtml += `<li>${ref.name}${badge}</li>`;
                            });
                            
                            referencesHtml += `</ul></div>`;
                        }
                        
                        // Rule Action references
                        if (ruleActionRefs.length > 0) {
                            referencesHtml += `<div class="reference-section">
                                <div class="reference-category">Rule Actions (${ruleActionRefs.length}):</div>
                                <ul class="references-list">`;
                            
                            ruleActionRefs.forEach(ref => {
                                let badge = '';
                                if (ref.isCustomCode) {
                                    badge = ' <span class="custom-code-badge">Custom Code</span>';
                                }
                                referencesHtml += `<li>${ref.name}${badge}</li>`;
                            });
                            
                            referencesHtml += `</ul></div>`;
                        }
                        
                        // Custom Code references
                        if (customCodeRefs.length > 0) {
                            referencesHtml += `<div class="reference-section">
                                <div class="reference-category">Custom Code (${customCodeRefs.length}):</div>
                                <ul class="references-list">`;
                            
                            customCodeRefs.forEach(ref => {
                                referencesHtml += `<li>${ref.name} ${ref.context}</li>`;
                            });
                            
                            referencesHtml += `</ul></div>`;
                        }
                        
                        // Data Element references
                        if (dataElementRefs.length > 0) {
                            referencesHtml += `<div class="reference-section">
                                <div class="reference-category">Data Elements (${dataElementRefs.length}):</div>
                                <ul class="references-list">`;
                            
                            dataElementRefs.forEach(ref => {
                                let badge = '';
                                if (ref.isCustomCode) {
                                    badge = ' <span class="custom-code-badge">Custom Code</span>';
                                }
                                referencesHtml += `<li>${ref.name}${badge}</li>`;
                            });
                            
                            referencesHtml += `</ul></div>`;
                        }
                        
                        // Extension references
                        if (extensionRefs.length > 0) {
                            referencesHtml += `<div class="reference-section">
                                <div class="reference-category">Extensions (${extensionRefs.length}):</div>
                                <ul class="references-list">`;
                            
                            extensionRefs.forEach(ref => {
                                referencesHtml += `<li>${ref.name} (${ref.context})</li>`;
                            });
                            
                            referencesHtml += `</ul></div>`;
                        }
                        
                        referencesHtml += '</div>';
                    } else {
                        // Use the badge-zero class for 0 references instead of badge
                        referencesHtml = '<span class="badge-zero">0</span> references';
                    }
                    
                    html += `<tr>
                        <td>${name}</td>
                        <td>${type}</td>
                        <td>${defaultValue}</td>
                        <td data-sort-value="${refCount}">${referencesHtml}</td>
                    </tr>`;
                });
                
                html += '</tbody></table></div>';
                dataElementsDiv.innerHTML = html;
                
                // Add click handlers for the reference details
                const cells = dataElementsDiv.querySelectorAll('td:nth-child(4) > div:first-child');
                cells.forEach(cell => {
                    if (cell.querySelector('.badge')) { // Only add click handler if it has a regular badge (not zero)
                        cell.style.cursor = 'pointer';
                        
                        cell.addEventListener('click', function() {
                            const content = this.nextElementSibling;
                            if (content.style.display === 'block') {
                                content.style.display = 'none';
                            } else {
                                content.style.display = 'block';
                            }
                        });
                    }
                });
                
                // Add sorting functionality
                const table = dataElementsDiv.querySelector('table');
                addSortingToTable(table);
            } else {
                dataElementsDiv.innerHTML = '<p>No data elements could be directly identified. Check the raw _satellite object for more details.</p>';
            }
        } catch (error) {
            dataElementsDiv.innerHTML = `<p>Error extracting data elements: ${error.message}</p>`;
            console.error('Error extracting data elements:', error);
        }
    }
    
    function extractRules() {
        const rulesDiv = document.getElementById('rulesInfo');
        
        try {
            // Try different ways to extract rules
            let rules = [];
            // Method 1: Check property.settings.rules
            if (_satellite.property && 
                _satellite.property.settings && 
                _satellite.property.settings.rules) {
                rules = _satellite.property.settings.rules;
            }
            // Method 2: Try container._rules
            else if (_satellite._container && 
                     _satellite._container.rules) {
                rules = _satellite._container.rules;
            }
            
            if (rules.length > 0) {
                let html = `<p>Found ${rules.length} rules:</p>`;
                html += '<div class="table-container"><table class="sortable-table">';
                html += '<thead><tr><th>Rule Name</th><th>Events</th><th>Data Elements Used</th></tr></thead><tbody>';
                
                rules.forEach(rule => {
                    let name = rule.name || 'Unnamed Rule';
                    let events = [];
                    
                    // Try to extract event types
                    if (rule.events && Array.isArray(rule.events)) {
                        events = rule.events.map(event => {
                            return event.type || event.modulePath || 'Unknown';
                        });
                    }
                    
                    // Get data elements used in this rule
                    const ruleResults = getDataElementsInRule(rule);
                    const dataElementsUsed = ruleResults.dataElementsUsed;
                    let dataElementsCell = '';
                    
                    if (dataElementsUsed.length > 0) {
                        dataElementsCell = dataElementsUsed.join(', ');
                    } else {
                        dataElementsCell = 'None';
                    }
                    
                    html += `<tr>
                        <td>${name}</td>
                        <td>${events.join(', ') || 'No events'}</td>
                        <td>${dataElementsCell}</td>
                    </tr>`;
                });
                
                html += '</tbody></table></div>';
                rulesDiv.innerHTML = html;
                
                // Add sorting functionality
                const table = rulesDiv.querySelector('table');
                addSortingToTable(table);
            } else {
                rulesDiv.innerHTML = '<p>No rules could be directly identified. Check the raw _satellite object for more details.</p>';
            }
        } catch (error) {
            rulesDiv.innerHTML = `<p>Error extracting rules: ${error.message}</p>`;
            console.error('Error extracting rules:', error);
        }
    }
    
    function getDataElementsInRule(rule) {
        let dataElementsUsed = new Set();
        let customCodeBlocks = [];
        
        // Function to scan an object for data element references
        function scanForDataElements(obj, context) {
            if (!obj) return;
            
            // Check for custom code in actions
            let isCustomCode = false;
            let customCodeContent = '';
            
            if (context === 'Action' && 
                (obj.type === 'javascript' || obj.type === 'custom_code' || 
                 (obj.modulePath && obj.modulePath.includes('custom-code')))) {
                isCustomCode = true;
                
                // Extract the code content
                if (obj.settings && obj.settings.source) {
                    customCodeContent = obj.settings.source;
                } else if (obj.source) {
                    customCodeContent = obj.source;
                } else if (obj.code) {
                    customCodeContent = obj.code;
                }
                
                // Add to custom code blocks
                if (customCodeContent) {
                    customCodeBlocks.push({
                        type: 'rule',
                        ruleName: rule.name,
                        context: context,
                        code: customCodeContent
                    });
                    
                    // Scan the custom code for data elements
                    scanCustomCodeForDataElements(customCodeContent, rule.name, context);
                }
            } else if (context === 'Condition' && 
                      (obj.type === 'custom_code' || 
                       (obj.modulePath && obj.modulePath.includes('custom-code')))) {
                isCustomCode = true;
                
                // Extract the code content
                if (obj.settings && obj.settings.source) {
                    customCodeContent = obj.settings.source;
                } else if (obj.source) {
                    customCodeContent = obj.source;
                }
                
                // Add to custom code blocks
                if (customCodeContent) {
                    customCodeBlocks.push({
                        type: 'rule',
                        ruleName: rule.name,
                        context: context,
                        code: customCodeContent
                    });
                    
                    // Scan the custom code for data elements
                    scanCustomCodeForDataElements(customCodeContent, rule.name, context);
                }
            }
            
            // If it's an object, look for properties that might contain data element references
            if (typeof obj === 'object' && obj !== null) {
                // Check for direct data element references
                if (obj.dataElementName) {
                    dataElementsUsed.add(obj.dataElementName);
                    
                    // Add reference for this data element
                    if (!dataElementReferences[obj.dataElementName]) {
                        dataElementReferences[obj.dataElementName] = [];
                    }
                    
                    dataElementReferences[obj.dataElementName].push({
                        type: 'rule',
                        name: rule.name,
                        context: context,
                        isCustomCode: isCustomCode
                    });
                }
                
                // Check each property
                Object.keys(obj).forEach(key => {
                    if (typeof obj[key] === 'string') {
                        // Look for data element notation (%dataElement%) in strings
                        const dataElements = findDataElementsInString(obj[key]);
                        
                        // Add all found data elements
                        dataElements.forEach(dataElement => {
                            dataElementsUsed.add(dataElement);
                            
                            // Add reference for this data element
                            if (!dataElementReferences[dataElement]) {
                                dataElementReferences[dataElement] = [];
                            }
                            
                            dataElementReferences[dataElement].push({
                                type: 'rule',
                                name: rule.name,
                                context: context,
                                property: key,
                                isCustomCode: isCustomCode
                            });
                        });
                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        // Recursively scan nested objects
                        scanForDataElements(obj[key], context);
                    }
                });
            }
        }
        
        // Scan rule events
        if (rule.events && Array.isArray(rule.events)) {
            rule.events.forEach(event => {
                scanForDataElements(event, 'Event');
            });
        }
        
        // Scan rule conditions
        if (rule.conditions && Array.isArray(rule.conditions)) {
            rule.conditions.forEach(condition => {
                scanForDataElements(condition, 'Condition');
            });
        }
        
        // Scan rule actions
        if (rule.actions && Array.isArray(rule.actions)) {
            rule.actions.forEach(action => {
                scanForDataElements(action, 'Action');
            });
        }
        
        return {
            dataElementsUsed: Array.from(dataElementsUsed),
            customCodeBlocks: customCodeBlocks
        };
    }
    
    function findDataElementsInString(str) {
        if (typeof str !== 'string') return [];
        
        const dataElements = new Set();
        
        // Pattern for %dataElement%
        const pattern1 = /%([^%]+)%/g;
        let match;
        
        while (match = pattern1.exec(str)) {
            dataElements.add(match[1]);
        }
        
        // Check for _satellite.getVar('dataElement')
        const pattern2 = /_satellite\.getVar\(['"](.*?)['"]\)/g;
        while (match = pattern2.exec(str)) {
            dataElements.add(match[1]);
        }
        
        return Array.from(dataElements);
    }
    
    function scanCustomCodeForDataElements(code, parentName, context) {
        if (typeof code !== 'string') return [];
        
        const dataElements = findDataElementsInString(code);
        
        // Add references for all found data elements
        dataElements.forEach(dataElement => {
            if (!dataElementReferences[dataElement]) {
                dataElementReferences[dataElement] = [];
            }
            
            dataElementReferences[dataElement].push({
                type: 'customCode',
                name: parentName,
                context: context,
                isCustomCode: true
            });
        });
        
        return dataElements;
    }
    
    function scanDataElementsForCustomCode() {
        try {
            let dataElementDetails = {};
            
            // Try to get data element details from different locations
            if (_satellite.property && 
                _satellite.property.settings && 
                _satellite.property.settings.dataElements) {
                dataElementDetails = _satellite.property.settings.dataElements;
            } else if (_satellite._container && 
                     _satellite._container.dataElements) {
                dataElementDetails = _satellite._container.dataElements;
            }
            
            // Scan each data element
            Object.keys(dataElementDetails).forEach(name => {
                const details = dataElementDetails[name];
                let isCustomCode = false;
                let codeContent = '';
                
                // Check if this is a custom code data element
                if (details.type === 'javascript' || 
                    details.type === 'custom_code' || 
                    (details.modulePath && details.modulePath.includes('custom-code'))) {
                    isCustomCode = true;
                    
                    // Extract the code content
                    if (details.settings && details.settings.source) {
                        codeContent = details.settings.source;
                    } else if (details.source) {
                        codeContent = details.source;
                    } else if (details.code) {
                        codeContent = details.code;
                    }
                }
                
                // If this is custom code, scan it for data element references
                if (isCustomCode && codeContent) {
                    const referencedElements = findDataElementsInString(codeContent);
                    
                    // Add references for all found data elements
                    referencedElements.forEach(refName => {
                        if (!dataElementReferences[refName]) {
                            dataElementReferences[refName] = [];
                        }
                        
                        dataElementReferences[refName].push({
                            type: 'dataElement',
                            name: name,
                            isCustomCode: true
                        });
                    });
                }
            });
        } catch (error) {
            console.error('Error scanning data elements for custom code:', error);
        }
    }
    
    function scanExtensionsForDataElements() {
        try {
            let extensionDetails = {};
            
            // Try to get extension details from different locations
            if (_satellite.extensionConfiguration) {
                extensionDetails = _satellite.extensionConfiguration;
            } else if (_satellite.property && 
                     _satellite.property.settings && 
                     _satellite.property.settings.extensions) {
                extensionDetails = _satellite.property.settings.extensions;
            }
            
            // Scan each extension
            Object.keys(extensionDetails).forEach(extName => {
                const extension = extensionDetails[extName];
                
                // Skip core extension
                if (extName === 'core') return;
                
                // Recursively scan extension settings
                function scanObject(obj, path) {
                    if (!obj || typeof obj !== 'object') return;
                    
                    // Check for data element references in strings
                    Object.keys(obj).forEach(key => {
                        if (typeof obj[key] === 'string') {
                            const dataElements = findDataElementsInString(obj[key]);
                            
                            // Add references for found data elements
                            dataElements.forEach(dataElement => {
                                if (!dataElementReferences[dataElement]) {
                                    dataElementReferences[dataElement] = [];
                                }
                                
                                dataElementReferences[dataElement].push({
                                    type: 'extension',
                                    name: extName,
                                    context: path ? `${path}.${key}` : key
                                });
                            });
                        } else if (obj[key] && typeof obj[key] === 'object') {
                            // Recursively scan nested objects
                            scanObject(obj[key], path ? `${path}.${key}` : key);
                        }
                    });
                }
                
                // Start scanning from the settings
                if (extension.settings) {
                    scanObject(extension.settings, 'settings');
                }
            });
        } catch (error) {
            console.error('Error scanning extensions for data elements:', error);
        }
    }
    
    function showSatelliteObject() {
        try {
            const satelliteDiv = document.getElementById('satelliteObject');
            
            // Create a simplified version of _satellite to avoid circular references
            const simplifiedSatellite = {};
            
            // Copy non-circular properties
            for (const key in _satellite) {
                try {
                    if (key === '_container') {
                        // Special handling for _container to avoid circular references
                        simplifiedSatellite[key] = {
                            dataElements: _satellite._container.dataElements ? Object.keys(_satellite._container.dataElements) : [],
                            extensions: _satellite._container.extensions ? Object.keys(_satellite._container.extensions) : [],
                            rules: _satellite._container.rules ? _satellite._container.rules.map(r => r.name) : []
                        };
                    } else if (typeof _satellite[key] !== 'function' && key !== 'logger') {
                        simplifiedSatellite[key] = _satellite[key];
                    }
                } catch (e) {
                    simplifiedSatellite[key] = `[Error accessing property: ${e.message}]`;
                }
            }
            
            // Convert to formatted JSON
            const json = JSON.stringify(simplifiedSatellite, null, 2);
            satelliteDiv.textContent = json;
        } catch (error) {
            console.error('Error displaying _satellite object:', error);
            const satelliteDiv = document.getElementById('satelliteObject');
            satelliteDiv.textContent = `Error accessing _satellite object: ${error.message}`;
        }
    }
    
    function showStatus(message, type) {
        statusDiv.innerHTML = message;
        statusDiv.className = type || '';
        statusDiv.style.display = 'block';
    }
    
    function escapeHtml(text) {
        if (text === undefined || text === null) return '';
        
        return text
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    function addSortingToTable(table) {
        if (!table) return;
        
        const headers = table.querySelectorAll('th');
        
        headers.forEach((header, index) => {
            header.setAttribute('data-index', index);
            header.addEventListener('click', function() {
                sortTable(table, index, this);
            });
        });
    }
    
    function sortTable(table, columnIndex, header) {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        // Get current direction
        let currentDir = header.classList.contains('sort-asc') ? 'asc' : 
                        header.classList.contains('sort-desc') ? 'desc' : 'none';
        
        // Determine new direction
        let newDir = currentDir === 'asc' ? 'desc' : 'asc';
        
        // Remove sort indicators from all headers
        const headers = table.querySelectorAll('th');
        headers.forEach(h => {
            h.classList.remove('sort-asc', 'sort-desc');
        });
        
        // Add sort indicator to current header
        header.classList.add(`sort-${newDir}`);
        
        // Sort rows
        rows.sort((rowA, rowB) => {
            const cellA = rowA.querySelectorAll('td')[columnIndex];
            const cellB = rowB.querySelectorAll('td')[columnIndex];
            
            // Check for data-sort-value attribute first
            let valueA = cellA.getAttribute('data-sort-value') || cellA.textContent.trim();
            let valueB = cellB.getAttribute('data-sort-value') || cellB.textContent.trim();
            
            // Try to convert to numbers for numeric comparison
            let numA = parseFloat(valueA);
            let numB = parseFloat(valueB);
            
            if (!isNaN(numA) && !isNaN(numB)) {
                return newDir === 'asc' ? numA - numB : numB - numA;
            }
            
            // String comparison
            return newDir === 'asc' 
                ? valueA.localeCompare(valueB) 
                : valueB.localeCompare(valueA);
        });
        
        // Re-append rows in the new order
        rows.forEach(row => tbody.appendChild(row));
    }
});
