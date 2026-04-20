import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Sidebar from '../../src/components/Sidebar.vue';

describe('Variable Drag Pipeline', () => {
    it('should set dataTransfer correctly on variable dragstart', () => {
        let transferKey = '';
        let effect = '';

        const dummyEvent = {
            dataTransfer: {
                setData(type, key) {
                    if (type === 'variable') {
                        transferKey = key;
                    }
                },
                effectAllowed: ''
            }
        };

        const wrapper = mount(Sidebar, {
            props: {
                isOpen: true,
                groupedVariables: {
                    'Test Group': [
                        { key: 'test_var', label: 'Test Var' }
                    ]
                }
            }
        });

        wrapper.vm.onDragStart(dummyEvent, 'test_var');

        expect(transferKey).toBe('test_var');
        expect(dummyEvent.dataTransfer.effectAllowed).toBe('copy');
    });
});
