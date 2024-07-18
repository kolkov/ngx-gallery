/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AnimationMetadataType, AUTO_STYLE, ɵPRE_STYLE as PRE_STYLE, } from '@angular/animations';
import { invalidQuery } from '../error_helpers';
import { interpolateParams, resolveTiming, resolveTimingValue, visitDslNode } from '../util';
import { createTimelineInstruction, } from './animation_timeline_instruction';
import { ElementInstructionMap } from './element_instruction_map';
const ONE_FRAME_IN_MILLISECONDS = 1;
const ENTER_TOKEN = ':enter';
const ENTER_TOKEN_REGEX = new RegExp(ENTER_TOKEN, 'g');
const LEAVE_TOKEN = ':leave';
const LEAVE_TOKEN_REGEX = new RegExp(LEAVE_TOKEN, 'g');
/*
 * The code within this file aims to generate web-animations-compatible keyframes from Angular's
 * animation DSL code.
 *
 * The code below will be converted from:
 *
 * ```
 * sequence([
 *   style({ opacity: 0 }),
 *   animate(1000, style({ opacity: 0 }))
 * ])
 * ```
 *
 * To:
 * ```
 * keyframes = [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }]
 * duration = 1000
 * delay = 0
 * easing = ''
 * ```
 *
 * For this operation to cover the combination of animation verbs (style, animate, group, etc...) a
 * combination of AST traversal and merge-sort-like algorithms are used.
 *
 * [AST Traversal]
 * Each of the animation verbs, when executed, will return an string-map object representing what
 * type of action it is (style, animate, group, etc...) and the data associated with it. This means
 * that when functional composition mix of these functions is evaluated (like in the example above)
 * then it will end up producing a tree of objects representing the animation itself.
 *
 * When this animation object tree is processed by the visitor code below it will visit each of the
 * verb statements within the visitor. And during each visit it will build the context of the
 * animation keyframes by interacting with the `TimelineBuilder`.
 *
 * [TimelineBuilder]
 * This class is responsible for tracking the styles and building a series of keyframe objects for a
 * timeline between a start and end time. The builder starts off with an initial timeline and each
 * time the AST comes across a `group()`, `keyframes()` or a combination of the two within a
 * `sequence()` then it will generate a sub timeline for each step as well as a new one after
 * they are complete.
 *
 * As the AST is traversed, the timing state on each of the timelines will be incremented. If a sub
 * timeline was created (based on one of the cases above) then the parent timeline will attempt to
 * merge the styles used within the sub timelines into itself (only with group() this will happen).
 * This happens with a merge operation (much like how the merge works in mergeSort) and it will only
 * copy the most recently used styles from the sub timelines into the parent timeline. This ensures
 * that if the styles are used later on in another phase of the animation then they will be the most
 * up-to-date values.
 *
 * [How Missing Styles Are Updated]
 * Each timeline has a `backFill` property which is responsible for filling in new styles into
 * already processed keyframes if a new style shows up later within the animation sequence.
 *
 * ```
 * sequence([
 *   style({ width: 0 }),
 *   animate(1000, style({ width: 100 })),
 *   animate(1000, style({ width: 200 })),
 *   animate(1000, style({ width: 300 }))
 *   animate(1000, style({ width: 400, height: 400 })) // notice how `height` doesn't exist anywhere
 * else
 * ])
 * ```
 *
 * What is happening here is that the `height` value is added later in the sequence, but is missing
 * from all previous animation steps. Therefore when a keyframe is created it would also be missing
 * from all previous keyframes up until where it is first used. For the timeline keyframe generation
 * to properly fill in the style it will place the previous value (the value from the parent
 * timeline) or a default value of `*` into the backFill map.
 *
 * When a sub-timeline is created it will have its own backFill property. This is done so that
 * styles present within the sub-timeline do not accidentally seep into the previous/future timeline
 * keyframes
 *
 * [Validation]
 * The code in this file is not responsible for validation. That functionality happens with within
 * the `AnimationValidatorVisitor` code.
 */
export function buildAnimationTimelines(driver, rootElement, ast, enterClassName, leaveClassName, startingStyles = new Map(), finalStyles = new Map(), options, subInstructions, errors = []) {
    return new AnimationTimelineBuilderVisitor().buildKeyframes(driver, rootElement, ast, enterClassName, leaveClassName, startingStyles, finalStyles, options, subInstructions, errors);
}
export class AnimationTimelineBuilderVisitor {
    buildKeyframes(driver, rootElement, ast, enterClassName, leaveClassName, startingStyles, finalStyles, options, subInstructions, errors = []) {
        subInstructions = subInstructions || new ElementInstructionMap();
        const context = new AnimationTimelineContext(driver, rootElement, subInstructions, enterClassName, leaveClassName, errors, []);
        context.options = options;
        const delay = options.delay ? resolveTimingValue(options.delay) : 0;
        context.currentTimeline.delayNextStep(delay);
        context.currentTimeline.setStyles([startingStyles], null, context.errors, options);
        visitDslNode(this, ast, context);
        // this checks to see if an actual animation happened
        const timelines = context.timelines.filter((timeline) => timeline.containsAnimation());
        // note: we just want to apply the final styles for the rootElement, so we do not
        //       just apply the styles to the last timeline but the last timeline which
        //       element is the root one (basically `*`-styles are replaced with the actual
        //       state style values only for the root element)
        if (timelines.length && finalStyles.size) {
            let lastRootTimeline;
            for (let i = timelines.length - 1; i >= 0; i--) {
                const timeline = timelines[i];
                if (timeline.element === rootElement) {
                    lastRootTimeline = timeline;
                    break;
                }
            }
            if (lastRootTimeline && !lastRootTimeline.allowOnlyTimelineStyles()) {
                lastRootTimeline.setStyles([finalStyles], null, context.errors, options);
            }
        }
        return timelines.length
            ? timelines.map((timeline) => timeline.buildKeyframes())
            : [createTimelineInstruction(rootElement, [], [], [], 0, delay, '', false)];
    }
    visitTrigger(ast, context) {
        // these values are not visited in this AST
    }
    visitState(ast, context) {
        // these values are not visited in this AST
    }
    visitTransition(ast, context) {
        // these values are not visited in this AST
    }
    visitAnimateChild(ast, context) {
        const elementInstructions = context.subInstructions.get(context.element);
        if (elementInstructions) {
            const innerContext = context.createSubContext(ast.options);
            const startTime = context.currentTimeline.currentTime;
            const endTime = this._visitSubInstructions(elementInstructions, innerContext, innerContext.options);
            if (startTime != endTime) {
                // we do this on the upper context because we created a sub context for
                // the sub child animations
                context.transformIntoNewTimeline(endTime);
            }
        }
        context.previousNode = ast;
    }
    visitAnimateRef(ast, context) {
        const innerContext = context.createSubContext(ast.options);
        innerContext.transformIntoNewTimeline();
        this._applyAnimationRefDelays([ast.options, ast.animation.options], context, innerContext);
        this.visitReference(ast.animation, innerContext);
        context.transformIntoNewTimeline(innerContext.currentTimeline.currentTime);
        context.previousNode = ast;
    }
    _applyAnimationRefDelays(animationsRefsOptions, context, innerContext) {
        for (const animationRefOptions of animationsRefsOptions) {
            const animationDelay = animationRefOptions?.delay;
            if (animationDelay) {
                const animationDelayValue = typeof animationDelay === 'number'
                    ? animationDelay
                    : resolveTimingValue(interpolateParams(animationDelay, animationRefOptions?.params ?? {}, context.errors));
                innerContext.delayNextStep(animationDelayValue);
            }
        }
    }
    _visitSubInstructions(instructions, context, options) {
        const startTime = context.currentTimeline.currentTime;
        let furthestTime = startTime;
        // this is a special-case for when a user wants to skip a sub
        // animation from being fired entirely.
        const duration = options.duration != null ? resolveTimingValue(options.duration) : null;
        const delay = options.delay != null ? resolveTimingValue(options.delay) : null;
        if (duration !== 0) {
            instructions.forEach((instruction) => {
                const instructionTimings = context.appendInstructionToTimeline(instruction, duration, delay);
                furthestTime = Math.max(furthestTime, instructionTimings.duration + instructionTimings.delay);
            });
        }
        return furthestTime;
    }
    visitReference(ast, context) {
        context.updateOptions(ast.options, true);
        visitDslNode(this, ast.animation, context);
        context.previousNode = ast;
    }
    visitSequence(ast, context) {
        const subContextCount = context.subContextCount;
        let ctx = context;
        const options = ast.options;
        if (options && (options.params || options.delay)) {
            ctx = context.createSubContext(options);
            ctx.transformIntoNewTimeline();
            if (options.delay != null) {
                if (ctx.previousNode.type == AnimationMetadataType.Style) {
                    ctx.currentTimeline.snapshotCurrentStyles();
                    ctx.previousNode = DEFAULT_NOOP_PREVIOUS_NODE;
                }
                const delay = resolveTimingValue(options.delay);
                ctx.delayNextStep(delay);
            }
        }
        if (ast.steps.length) {
            ast.steps.forEach((s) => visitDslNode(this, s, ctx));
            // this is here just in case the inner steps only contain or end with a style() call
            ctx.currentTimeline.applyStylesToKeyframe();
            // this means that some animation function within the sequence
            // ended up creating a sub timeline (which means the current
            // timeline cannot overlap with the contents of the sequence)
            if (ctx.subContextCount > subContextCount) {
                ctx.transformIntoNewTimeline();
            }
        }
        context.previousNode = ast;
    }
    visitGroup(ast, context) {
        const innerTimelines = [];
        let furthestTime = context.currentTimeline.currentTime;
        const delay = ast.options && ast.options.delay ? resolveTimingValue(ast.options.delay) : 0;
        ast.steps.forEach((s) => {
            const innerContext = context.createSubContext(ast.options);
            if (delay) {
                innerContext.delayNextStep(delay);
            }
            visitDslNode(this, s, innerContext);
            furthestTime = Math.max(furthestTime, innerContext.currentTimeline.currentTime);
            innerTimelines.push(innerContext.currentTimeline);
        });
        // this operation is run after the AST loop because otherwise
        // if the parent timeline's collected styles were updated then
        // it would pass in invalid data into the new-to-be forked items
        innerTimelines.forEach((timeline) => context.currentTimeline.mergeTimelineCollectedStyles(timeline));
        context.transformIntoNewTimeline(furthestTime);
        context.previousNode = ast;
    }
    _visitTiming(ast, context) {
        if (ast.dynamic) {
            const strValue = ast.strValue;
            const timingValue = context.params
                ? interpolateParams(strValue, context.params, context.errors)
                : strValue;
            return resolveTiming(timingValue, context.errors);
        }
        else {
            return { duration: ast.duration, delay: ast.delay, easing: ast.easing };
        }
    }
    visitAnimate(ast, context) {
        const timings = (context.currentAnimateTimings = this._visitTiming(ast.timings, context));
        const timeline = context.currentTimeline;
        if (timings.delay) {
            context.incrementTime(timings.delay);
            timeline.snapshotCurrentStyles();
        }
        const style = ast.style;
        if (style.type == AnimationMetadataType.Keyframes) {
            this.visitKeyframes(style, context);
        }
        else {
            context.incrementTime(timings.duration);
            this.visitStyle(style, context);
            timeline.applyStylesToKeyframe();
        }
        context.currentAnimateTimings = null;
        context.previousNode = ast;
    }
    visitStyle(ast, context) {
        const timeline = context.currentTimeline;
        const timings = context.currentAnimateTimings;
        // this is a special case for when a style() call
        // directly follows  an animate() call (but not inside of an animate() call)
        if (!timings && timeline.hasCurrentStyleProperties()) {
            timeline.forwardFrame();
        }
        const easing = (timings && timings.easing) || ast.easing;
        if (ast.isEmptyStep) {
            timeline.applyEmptyStep(easing);
        }
        else {
            timeline.setStyles(ast.styles, easing, context.errors, context.options);
        }
        context.previousNode = ast;
    }
    visitKeyframes(ast, context) {
        const currentAnimateTimings = context.currentAnimateTimings;
        const startTime = context.currentTimeline.duration;
        const duration = currentAnimateTimings.duration;
        const innerContext = context.createSubContext();
        const innerTimeline = innerContext.currentTimeline;
        innerTimeline.easing = currentAnimateTimings.easing;
        ast.styles.forEach((step) => {
            const offset = step.offset || 0;
            innerTimeline.forwardTime(offset * duration);
            innerTimeline.setStyles(step.styles, step.easing, context.errors, context.options);
            innerTimeline.applyStylesToKeyframe();
        });
        // this will ensure that the parent timeline gets all the styles from
        // the child even if the new timeline below is not used
        context.currentTimeline.mergeTimelineCollectedStyles(innerTimeline);
        // we do this because the window between this timeline and the sub timeline
        // should ensure that the styles within are exactly the same as they were before
        context.transformIntoNewTimeline(startTime + duration);
        context.previousNode = ast;
    }
    visitQuery(ast, context) {
        // in the event that the first step before this is a style step we need
        // to ensure the styles are applied before the children are animated
        const startTime = context.currentTimeline.currentTime;
        const options = (ast.options || {});
        const delay = options.delay ? resolveTimingValue(options.delay) : 0;
        if (delay &&
            (context.previousNode.type === AnimationMetadataType.Style ||
                (startTime == 0 && context.currentTimeline.hasCurrentStyleProperties()))) {
            context.currentTimeline.snapshotCurrentStyles();
            context.previousNode = DEFAULT_NOOP_PREVIOUS_NODE;
        }
        let furthestTime = startTime;
        const elms = context.invokeQuery(ast.selector, ast.originalSelector, ast.limit, ast.includeSelf, options.optional ? true : false, context.errors);
        context.currentQueryTotal = elms.length;
        let sameElementTimeline = null;
        elms.forEach((element, i) => {
            context.currentQueryIndex = i;
            const innerContext = context.createSubContext(ast.options, element);
            if (delay) {
                innerContext.delayNextStep(delay);
            }
            if (element === context.element) {
                sameElementTimeline = innerContext.currentTimeline;
            }
            visitDslNode(this, ast.animation, innerContext);
            // this is here just incase the inner steps only contain or end
            // with a style() call (which is here to signal that this is a preparatory
            // call to style an element before it is animated again)
            innerContext.currentTimeline.applyStylesToKeyframe();
            const endTime = innerContext.currentTimeline.currentTime;
            furthestTime = Math.max(furthestTime, endTime);
        });
        context.currentQueryIndex = 0;
        context.currentQueryTotal = 0;
        context.transformIntoNewTimeline(furthestTime);
        if (sameElementTimeline) {
            context.currentTimeline.mergeTimelineCollectedStyles(sameElementTimeline);
            context.currentTimeline.snapshotCurrentStyles();
        }
        context.previousNode = ast;
    }
    visitStagger(ast, context) {
        const parentContext = context.parentContext;
        const tl = context.currentTimeline;
        const timings = ast.timings;
        const duration = Math.abs(timings.duration);
        const maxTime = duration * (context.currentQueryTotal - 1);
        let delay = duration * context.currentQueryIndex;
        let staggerTransformer = timings.duration < 0 ? 'reverse' : timings.easing;
        switch (staggerTransformer) {
            case 'reverse':
                delay = maxTime - delay;
                break;
            case 'full':
                delay = parentContext.currentStaggerTime;
                break;
        }
        const timeline = context.currentTimeline;
        if (delay) {
            timeline.delayNextStep(delay);
        }
        const startingTime = timeline.currentTime;
        visitDslNode(this, ast.animation, context);
        context.previousNode = ast;
        // time = duration + delay
        // the reason why this computation is so complex is because
        // the inner timeline may either have a delay value or a stretched
        // keyframe depending on if a subtimeline is not used or is used.
        parentContext.currentStaggerTime =
            tl.currentTime - startingTime + (tl.startTime - parentContext.currentTimeline.startTime);
    }
}
const DEFAULT_NOOP_PREVIOUS_NODE = {};
export class AnimationTimelineContext {
    constructor(_driver, element, subInstructions, _enterClassName, _leaveClassName, errors, timelines, initialTimeline) {
        this._driver = _driver;
        this.element = element;
        this.subInstructions = subInstructions;
        this._enterClassName = _enterClassName;
        this._leaveClassName = _leaveClassName;
        this.errors = errors;
        this.timelines = timelines;
        this.parentContext = null;
        this.currentAnimateTimings = null;
        this.previousNode = DEFAULT_NOOP_PREVIOUS_NODE;
        this.subContextCount = 0;
        this.options = {};
        this.currentQueryIndex = 0;
        this.currentQueryTotal = 0;
        this.currentStaggerTime = 0;
        this.currentTimeline = initialTimeline || new TimelineBuilder(this._driver, element, 0);
        timelines.push(this.currentTimeline);
    }
    get params() {
        return this.options.params;
    }
    updateOptions(options, skipIfExists) {
        if (!options)
            return;
        const newOptions = options;
        let optionsToUpdate = this.options;
        // NOTE: this will get patched up when other animation methods support duration overrides
        if (newOptions.duration != null) {
            optionsToUpdate.duration = resolveTimingValue(newOptions.duration);
        }
        if (newOptions.delay != null) {
            optionsToUpdate.delay = resolveTimingValue(newOptions.delay);
        }
        const newParams = newOptions.params;
        if (newParams) {
            let paramsToUpdate = optionsToUpdate.params;
            if (!paramsToUpdate) {
                paramsToUpdate = this.options.params = {};
            }
            Object.keys(newParams).forEach((name) => {
                if (!skipIfExists || !paramsToUpdate.hasOwnProperty(name)) {
                    paramsToUpdate[name] = interpolateParams(newParams[name], paramsToUpdate, this.errors);
                }
            });
        }
    }
    _copyOptions() {
        const options = {};
        if (this.options) {
            const oldParams = this.options.params;
            if (oldParams) {
                const params = (options['params'] = {});
                Object.keys(oldParams).forEach((name) => {
                    params[name] = oldParams[name];
                });
            }
        }
        return options;
    }
    createSubContext(options = null, element, newTime) {
        const target = element || this.element;
        const context = new AnimationTimelineContext(this._driver, target, this.subInstructions, this._enterClassName, this._leaveClassName, this.errors, this.timelines, this.currentTimeline.fork(target, newTime || 0));
        context.previousNode = this.previousNode;
        context.currentAnimateTimings = this.currentAnimateTimings;
        context.options = this._copyOptions();
        context.updateOptions(options);
        context.currentQueryIndex = this.currentQueryIndex;
        context.currentQueryTotal = this.currentQueryTotal;
        context.parentContext = this;
        this.subContextCount++;
        return context;
    }
    transformIntoNewTimeline(newTime) {
        this.previousNode = DEFAULT_NOOP_PREVIOUS_NODE;
        this.currentTimeline = this.currentTimeline.fork(this.element, newTime);
        this.timelines.push(this.currentTimeline);
        return this.currentTimeline;
    }
    appendInstructionToTimeline(instruction, duration, delay) {
        const updatedTimings = {
            duration: duration != null ? duration : instruction.duration,
            delay: this.currentTimeline.currentTime + (delay != null ? delay : 0) + instruction.delay,
            easing: '',
        };
        const builder = new SubTimelineBuilder(this._driver, instruction.element, instruction.keyframes, instruction.preStyleProps, instruction.postStyleProps, updatedTimings, instruction.stretchStartingKeyframe);
        this.timelines.push(builder);
        return updatedTimings;
    }
    incrementTime(time) {
        this.currentTimeline.forwardTime(this.currentTimeline.duration + time);
    }
    delayNextStep(delay) {
        // negative delays are not yet supported
        if (delay > 0) {
            this.currentTimeline.delayNextStep(delay);
        }
    }
    invokeQuery(selector, originalSelector, limit, includeSelf, optional, errors) {
        let results = [];
        if (includeSelf) {
            results.push(this.element);
        }
        if (selector.length > 0) {
            // only if :self is used then the selector can be empty
            selector = selector.replace(ENTER_TOKEN_REGEX, '.' + this._enterClassName);
            selector = selector.replace(LEAVE_TOKEN_REGEX, '.' + this._leaveClassName);
            const multi = limit != 1;
            let elements = this._driver.query(this.element, selector, multi);
            if (limit !== 0) {
                elements =
                    limit < 0
                        ? elements.slice(elements.length + limit, elements.length)
                        : elements.slice(0, limit);
            }
            results.push(...elements);
        }
        if (!optional && results.length == 0) {
            errors.push(invalidQuery(originalSelector));
        }
        return results;
    }
}
export class TimelineBuilder {
    constructor(_driver, element, startTime, _elementTimelineStylesLookup) {
        this._driver = _driver;
        this.element = element;
        this.startTime = startTime;
        this._elementTimelineStylesLookup = _elementTimelineStylesLookup;
        this.duration = 0;
        this.easing = null;
        this._previousKeyframe = new Map();
        this._currentKeyframe = new Map();
        this._keyframes = new Map();
        this._styleSummary = new Map();
        this._localTimelineStyles = new Map();
        this._pendingStyles = new Map();
        this._backFill = new Map();
        this._currentEmptyStepKeyframe = null;
        if (!this._elementTimelineStylesLookup) {
            this._elementTimelineStylesLookup = new Map();
        }
        this._globalTimelineStyles = this._elementTimelineStylesLookup.get(element);
        if (!this._globalTimelineStyles) {
            this._globalTimelineStyles = this._localTimelineStyles;
            this._elementTimelineStylesLookup.set(element, this._localTimelineStyles);
        }
        this._loadKeyframe();
    }
    containsAnimation() {
        switch (this._keyframes.size) {
            case 0:
                return false;
            case 1:
                return this.hasCurrentStyleProperties();
            default:
                return true;
        }
    }
    hasCurrentStyleProperties() {
        return this._currentKeyframe.size > 0;
    }
    get currentTime() {
        return this.startTime + this.duration;
    }
    delayNextStep(delay) {
        // in the event that a style() step is placed right before a stagger()
        // and that style() step is the very first style() value in the animation
        // then we need to make a copy of the keyframe [0, copy, 1] so that the delay
        // properly applies the style() values to work with the stagger...
        const hasPreStyleStep = this._keyframes.size === 1 && this._pendingStyles.size;
        if (this.duration || hasPreStyleStep) {
            this.forwardTime(this.currentTime + delay);
            if (hasPreStyleStep) {
                this.snapshotCurrentStyles();
            }
        }
        else {
            this.startTime += delay;
        }
    }
    fork(element, currentTime) {
        this.applyStylesToKeyframe();
        return new TimelineBuilder(this._driver, element, currentTime || this.currentTime, this._elementTimelineStylesLookup);
    }
    _loadKeyframe() {
        if (this._currentKeyframe) {
            this._previousKeyframe = this._currentKeyframe;
        }
        this._currentKeyframe = this._keyframes.get(this.duration);
        if (!this._currentKeyframe) {
            this._currentKeyframe = new Map();
            this._keyframes.set(this.duration, this._currentKeyframe);
        }
    }
    forwardFrame() {
        this.duration += ONE_FRAME_IN_MILLISECONDS;
        this._loadKeyframe();
    }
    forwardTime(time) {
        this.applyStylesToKeyframe();
        this.duration = time;
        this._loadKeyframe();
    }
    _updateStyle(prop, value) {
        this._localTimelineStyles.set(prop, value);
        this._globalTimelineStyles.set(prop, value);
        this._styleSummary.set(prop, { time: this.currentTime, value });
    }
    allowOnlyTimelineStyles() {
        return this._currentEmptyStepKeyframe !== this._currentKeyframe;
    }
    applyEmptyStep(easing) {
        if (easing) {
            this._previousKeyframe.set('easing', easing);
        }
        // special case for animate(duration):
        // all missing styles are filled with a `*` value then
        // if any destination styles are filled in later on the same
        // keyframe then they will override the overridden styles
        // We use `_globalTimelineStyles` here because there may be
        // styles in previous keyframes that are not present in this timeline
        for (let [prop, value] of this._globalTimelineStyles) {
            this._backFill.set(prop, value || AUTO_STYLE);
            this._currentKeyframe.set(prop, AUTO_STYLE);
        }
        this._currentEmptyStepKeyframe = this._currentKeyframe;
    }
    setStyles(input, easing, errors, options) {
        if (easing) {
            this._previousKeyframe.set('easing', easing);
        }
        const params = (options && options.params) || {};
        const styles = flattenStyles(input, this._globalTimelineStyles);
        for (let [prop, value] of styles) {
            const val = interpolateParams(value, params, errors);
            this._pendingStyles.set(prop, val);
            if (!this._localTimelineStyles.has(prop)) {
                this._backFill.set(prop, this._globalTimelineStyles.get(prop) ?? AUTO_STYLE);
            }
            this._updateStyle(prop, val);
        }
    }
    applyStylesToKeyframe() {
        if (this._pendingStyles.size == 0)
            return;
        this._pendingStyles.forEach((val, prop) => {
            this._currentKeyframe.set(prop, val);
        });
        this._pendingStyles.clear();
        this._localTimelineStyles.forEach((val, prop) => {
            if (!this._currentKeyframe.has(prop)) {
                this._currentKeyframe.set(prop, val);
            }
        });
    }
    snapshotCurrentStyles() {
        for (let [prop, val] of this._localTimelineStyles) {
            this._pendingStyles.set(prop, val);
            this._updateStyle(prop, val);
        }
    }
    getFinalKeyframe() {
        return this._keyframes.get(this.duration);
    }
    get properties() {
        const properties = [];
        for (let prop in this._currentKeyframe) {
            properties.push(prop);
        }
        return properties;
    }
    mergeTimelineCollectedStyles(timeline) {
        timeline._styleSummary.forEach((details1, prop) => {
            const details0 = this._styleSummary.get(prop);
            if (!details0 || details1.time > details0.time) {
                this._updateStyle(prop, details1.value);
            }
        });
    }
    buildKeyframes() {
        this.applyStylesToKeyframe();
        const preStyleProps = new Set();
        const postStyleProps = new Set();
        const isEmpty = this._keyframes.size === 1 && this.duration === 0;
        let finalKeyframes = [];
        this._keyframes.forEach((keyframe, time) => {
            const finalKeyframe = new Map([...this._backFill, ...keyframe]);
            finalKeyframe.forEach((value, prop) => {
                if (value === PRE_STYLE) {
                    preStyleProps.add(prop);
                }
                else if (value === AUTO_STYLE) {
                    postStyleProps.add(prop);
                }
            });
            if (!isEmpty) {
                finalKeyframe.set('offset', time / this.duration);
            }
            finalKeyframes.push(finalKeyframe);
        });
        const preProps = [...preStyleProps.values()];
        const postProps = [...postStyleProps.values()];
        // special case for a 0-second animation (which is designed just to place styles onscreen)
        if (isEmpty) {
            const kf0 = finalKeyframes[0];
            const kf1 = new Map(kf0);
            kf0.set('offset', 0);
            kf1.set('offset', 1);
            finalKeyframes = [kf0, kf1];
        }
        return createTimelineInstruction(this.element, finalKeyframes, preProps, postProps, this.duration, this.startTime, this.easing, false);
    }
}
class SubTimelineBuilder extends TimelineBuilder {
    constructor(driver, element, keyframes, preStyleProps, postStyleProps, timings, _stretchStartingKeyframe = false) {
        super(driver, element, timings.delay);
        this.keyframes = keyframes;
        this.preStyleProps = preStyleProps;
        this.postStyleProps = postStyleProps;
        this._stretchStartingKeyframe = _stretchStartingKeyframe;
        this.timings = { duration: timings.duration, delay: timings.delay, easing: timings.easing };
    }
    containsAnimation() {
        return this.keyframes.length > 1;
    }
    buildKeyframes() {
        let keyframes = this.keyframes;
        let { delay, duration, easing } = this.timings;
        if (this._stretchStartingKeyframe && delay) {
            const newKeyframes = [];
            const totalTime = duration + delay;
            const startingGap = delay / totalTime;
            // the original starting keyframe now starts once the delay is done
            const newFirstKeyframe = new Map(keyframes[0]);
            newFirstKeyframe.set('offset', 0);
            newKeyframes.push(newFirstKeyframe);
            const oldFirstKeyframe = new Map(keyframes[0]);
            oldFirstKeyframe.set('offset', roundOffset(startingGap));
            newKeyframes.push(oldFirstKeyframe);
            /*
              When the keyframe is stretched then it means that the delay before the animation
              starts is gone. Instead the first keyframe is placed at the start of the animation
              and it is then copied to where it starts when the original delay is over. This basically
              means nothing animates during that delay, but the styles are still rendered. For this
              to work the original offset values that exist in the original keyframes must be "warped"
              so that they can take the new keyframe + delay into account.
      
              delay=1000, duration=1000, keyframes = 0 .5 1
      
              turns into
      
              delay=0, duration=2000, keyframes = 0 .33 .66 1
             */
            // offsets between 1 ... n -1 are all warped by the keyframe stretch
            const limit = keyframes.length - 1;
            for (let i = 1; i <= limit; i++) {
                let kf = new Map(keyframes[i]);
                const oldOffset = kf.get('offset');
                const timeAtKeyframe = delay + oldOffset * duration;
                kf.set('offset', roundOffset(timeAtKeyframe / totalTime));
                newKeyframes.push(kf);
            }
            // the new starting keyframe should be added at the start
            duration = totalTime;
            delay = 0;
            easing = '';
            keyframes = newKeyframes;
        }
        return createTimelineInstruction(this.element, keyframes, this.preStyleProps, this.postStyleProps, duration, delay, easing, true);
    }
}
function roundOffset(offset, decimalPoints = 3) {
    const mult = Math.pow(10, decimalPoints - 1);
    return Math.round(offset * mult) / mult;
}
function flattenStyles(input, allStyles) {
    const styles = new Map();
    let allProperties;
    input.forEach((token) => {
        if (token === '*') {
            allProperties ??= allStyles.keys();
            for (let prop of allProperties) {
                styles.set(prop, AUTO_STYLE);
            }
        }
        else {
            for (let [prop, val] of token) {
                styles.set(prop, val);
            }
        }
    });
    return styles;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbWF0aW9uX3RpbWVsaW5lX2J1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmltYXRpb25zL2Jyb3dzZXIvc3JjL2RzbC9hbmltYXRpb25fdGltZWxpbmVfYnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEVBR0wscUJBQXFCLEVBR3JCLFVBQVUsRUFDVixVQUFVLElBQUksU0FBUyxHQUV4QixNQUFNLHFCQUFxQixDQUFDO0FBRTdCLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUU5QyxPQUFPLEVBQUMsaUJBQWlCLEVBQUUsYUFBYSxFQUFFLGtCQUFrQixFQUFFLFlBQVksRUFBQyxNQUFNLFNBQVMsQ0FBQztBQXFCM0YsT0FBTyxFQUVMLHlCQUF5QixHQUMxQixNQUFNLGtDQUFrQyxDQUFDO0FBQzFDLE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBRWhFLE1BQU0seUJBQXlCLEdBQUcsQ0FBQyxDQUFDO0FBQ3BDLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQztBQUM3QixNQUFNLGlCQUFpQixHQUFHLElBQUksTUFBTSxDQUFDLFdBQVcsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN2RCxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUM7QUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFFdkQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNkVHO0FBQ0gsTUFBTSxVQUFVLHVCQUF1QixDQUNyQyxNQUF1QixFQUN2QixXQUFnQixFQUNoQixHQUErQixFQUMvQixjQUFzQixFQUN0QixjQUFzQixFQUN0QixpQkFBZ0Ms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SUFDSixDQUFDO0NBQ0Y7QUFFRCxTQUFTLFdBQVcsQ0FBQyxNQUFjLEVBQUUsYUFBYSxHQUFHLENBQUM7SUFDcEQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzdDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDO0FBQzFDLENBQUM7QUFFRCxTQUFTLGFBQWEsQ0FBQyxLQUFvQyxFQUFFLFNBQXdCO0lBQ25GLE1BQU0sTUFBTSxHQUFrQixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ3hDLElBQUksYUFBa0QsQ0FBQztJQUN2RCxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7UUFDdEIsSUFBSSxLQUFLLEtBQUssR0FBRyxFQUFFLENBQUM7WUFDbEIsYUFBYSxLQUFLLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNuQyxLQUFLLElBQUksSUFBSSxJQUFJLGFBQWEsRUFBRSxDQUFDO2dCQUMvQixNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztZQUMvQixDQUFDO1FBQ0gsQ0FBQzthQUFNLENBQUM7WUFDTixLQUFLLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksS0FBc0IsRUFBRSxDQUFDO2dCQUMvQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztZQUN4QixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtcbiAgQW5pbWF0ZUNoaWxkT3B0aW9ucyxcbiAgQW5pbWF0ZVRpbWluZ3MsXG4gIEFuaW1hdGlvbk1ldGFkYXRhVHlwZSxcbiAgQW5pbWF0aW9uT3B0aW9ucyxcbiAgQW5pbWF0aW9uUXVlcnlPcHRpb25zLFxuICBBVVRPX1NUWUxFLFxuICDJtVBSRV9TVFlMRSBhcyBQUkVfU1RZTEUsXG4gIMm1U3R5bGVEYXRhTWFwLFxufSBmcm9tICdAYW5ndWxhci9hbmltYXRpb25zJztcblxuaW1wb3J0IHtpbnZhbGlkUXVlcnl9IGZyb20gJy4uL2Vycm9yX2hlbHBlcnMnO1xuaW1wb3J0IHtBbmltYXRpb25Ecml2ZXJ9IGZyb20gJy4uL3JlbmRlci9hbmltYXRpb25fZHJpdmVyJztcbmltcG9ydCB7aW50ZXJwb2xhdGVQYXJhbXMsIHJlc29sdmVUaW1pbmcsIHJlc29sdmVUaW1pbmdWYWx1ZSwgdmlzaXREc2xOb2RlfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtcbiAgQW5pbWF0ZUFzdCxcbiAgQW5pbWF0ZUNoaWxkQXN0LFxuICBBbmltYXRlUmVmQXN0LFxuICBBc3QsXG4gIEFzdFZpc2l0b3IsXG4gIER5bmFtaWNUaW1pbmdBc3QsXG4gIEdyb3VwQXN0LFxuICBLZXlmcmFtZXNBc3QsXG4gIFF1ZXJ5QXN0LFxuICBSZWZlcmVuY2VBc3QsXG4gIFNlcXVlbmNlQXN0LFxuICBTdGFnZ2VyQXN0LFxuICBTdGF0ZUFzdCxcbiAgU3R5bGVBc3QsXG4gIFRpbWluZ0FzdCxcbiAgVHJhbnNpdGlvbkFzdCxcbiAgVHJpZ2dlckFzdCxcbn0gZnJvbSAnLi9hbmltYXRpb25fYXN0JztcbmltcG9ydCB7XG4gIEFuaW1hdGlvblRpbWVsaW5lSW5zdHJ1Y3Rpb24sXG4gIGNyZWF0ZVRpbWVsaW5lSW5zdHJ1Y3Rpb24sXG59IGZyb20gJy4vYW5pbWF0aW9uX3RpbWVsaW5lX2luc3RydWN0aW9uJztcbmltcG9ydCB7RWxlbWVudEluc3RydWN0aW9uTWFwfSBmcm9tICcuL2VsZW1lbnRfaW5zdHJ1Y3Rpb25fbWFwJztcblxuY29uc3QgT05FX0ZSQU1FX0lOX01JTExJU0VDT05EUyA9IDE7XG5jb25zdCBFTlRFUl9UT0tFTiA9ICc6ZW50ZXInO1xuY29uc3QgRU5URVJfVE9LRU5fUkVHRVggPSBuZXcgUmVnRXhwKEVOVEVSX1RPS0VOLCAnZycpO1xuY29uc3QgTEVBVkVfVE9LRU4gPSAnOmxlYXZlJztcbmNvbnN0IExFQVZFX1RPS0VOX1JFR0VYID0gbmV3IFJlZ0V4cChMRUFWRV9UT0tFTiwgJ2cnKTtcblxuLypcbiAqIFRoZSBjb2RlIHdpdGhpbiB0aGlzIGZpbGUgYWltcyB0byBnZW5lcmF0ZSB3ZWItYW5pbWF0aW9ucy1jb21wYXRpYmxlIGtleWZyYW1lcyBmcm9tIEFuZ3VsYXInc1xuICogYW5pbWF0aW9uIERTTCBjb2RlLlxuICpcbiAqIFRoZSBjb2RlIGJlbG93IHdpbGwgYmUgY29udmVydGVkIGZyb206XG4gKlxuICogYGBgXG4gKiBzZXF1ZW5jZShbXG4gKiAgIHN0eWxlKHsgb3BhY2l0eTogMCB9KSxcbiAqICAgYW5pbWF0ZSgxMDAwLCBzdHlsZSh7IG9wYWNpdHk6IDAgfSkpXG4gKiBdKVxuICogYGBgXG4gKlxuICogVG86XG4gKiBgYGBcbiAqIGtleWZyYW1lcyA9IFt7IG9wYWNpdHk6IDAsIG9mZnNldDogMCB9LCB7IG9wYWNpdHk6IDEsIG9mZnNldDogMSB9XVxuICogZHVyYXRpb24gPSAxMDAwXG4gKiBkZWxheSA9IDBcbiAqIGVhc2luZyA9ICcnXG4gKiBgYGBcbiAqXG4gKiBGb3IgdGhpcyBvcGVyYXRpb24gdG8gY292ZXIgdGhlIGNvbWJpbmF0aW9uIG9mIGFuaW1hdGlvbiB2ZXJicyAoc3R5bGUsIGFuaW1hdGUsIGdyb3VwLCBldGMuLi4pIGFcbiAqIGNvbWJpbmF0aW9uIG9mIEFTVCB0cmF2ZXJzYWwgYW5kIG1lcmdlLXNvcnQtbGlrZSBhbGdvcml0aG1zIGFyZSB1c2VkLlxuICpcbiAqIFtBU1QgVHJhdmVyc2FsXVxuICogRWFjaCBvZiB0aGUgYW5pbWF0aW9uIHZlcmJzLCB3aGVuIGV4ZWN1dGVkLCB3aWxsIHJldHVybiBhbiBzdHJpbmctbWFwIG9iamVjdCByZXByZXNlbnRpbmcgd2hhdFxuICogdHlwZSBvZiBhY3Rpb24gaXQgaXMgKHN0eWxlLCBhbmltYXRlLCBncm91cCwgZXRjLi4uKSBhbmQgdGhlIGRhdGEgYXNzb2NpYXRlZCB3aXRoIGl0LiBUaGlzIG1lYW5zXG4gKiB0aGF0IHdoZW4gZnVuY3Rpb25hbCBjb21wb3NpdGlvbiBtaXggb2YgdGhlc2UgZnVuY3Rpb25zIGlzIGV2YWx1YXRlZCAobGlrZSBpbiB0aGUgZXhhbXBsZSBhYm92ZSlcbiAqIHRoZW4gaXQgd2lsbCBlbmQgdXAgcHJvZHVjaW5nIGEgdHJlZSBvZiBvYmplY3RzIHJlcHJlc2VudGluZyB0aGUgYW5pbWF0aW9uIGl0c2VsZi5cbiAqXG4gKiBXaGVuIHRoaXMgYW5pbWF0aW9uIG9iamVjdCB0cmVlIGlzIHByb2Nlc3NlZCBieSB0aGUgdmlzaXRvciBjb2RlIGJlbG93IGl0IHdpbGwgdmlzaXQgZWFjaCBvZiB0aGVcbiAqIHZlcmIgc3RhdGVtZW50cyB3aXRoaW4gdGhlIHZpc2l0b3IuIEFuZCBkdXJpbmcgZWFjaCB2aXNpdCBpdCB3aWxsIGJ1aWxkIHRoZSBjb250ZXh0IG9mIHRoZVxuICogYW5pbWF0aW9uIGtleWZyYW1lcyBieSBpbnRlcmFjdGluZyB3aXRoIHRoZSBgVGltZWxpbmVCdWlsZGVyYC5cbiAqXG4gKiBbVGltZWxpbmVCdWlsZGVyXVxuICogVGhpcyBjbGFzcyBpcyByZXNwb25zaWJsZSBmb3IgdHJhY2tpbmcgdGhlIHN0eWxlcyBhbmQgYnVpbGRpbmcgYSBzZXJpZXMgb2Yga2V5ZnJhbWUgb2JqZWN0cyBmb3IgYVxuICogdGltZWxpbmUgYmV0d2VlbiBhIHN0YXJ0IGFuZCBlbmQgdGltZS4gVGhlIGJ1aWxkZXIgc3RhcnRzIG9mZiB3aXRoIGFuIGluaXRpYWwgdGltZWxpbmUgYW5kIGVhY2hcbiAqIHRpbWUgdGhlIEFTVCBjb21lcyBhY3Jvc3MgYSBgZ3JvdXAoKWAsIGBrZXlmcmFtZXMoKWAgb3IgYSBjb21iaW5hdGlvbiBvZiB0aGUgdHdvIHdpdGhpbiBhXG4gKiBgc2VxdWVuY2UoKWAgdGhlbiBpdCB3aWxsIGdlbmVyYXRlIGEgc3ViIHRpbWVsaW5lIGZvciBlYWNoIHN0ZXAgYXMgd2VsbCBhcyBhIG5ldyBvbmUgYWZ0ZXJcbiAqIHRoZXkgYXJlIGNvbXBsZXRlLlxuICpcbiAqIEFzIHRoZSBBU1QgaXMgdHJhdmVyc2VkLCB0aGUgdGltaW5nIHN0YXRlIG9uIGVhY2ggb2YgdGhlIHRpbWVsaW5lcyB3aWxsIGJlIGluY3JlbWVudGVkLiBJZiBhIHN1YlxuICogdGltZWxpbmUgd2FzIGNyZWF0ZWQgKGJhc2VkIG9uIG9uZSBvZiB0aGUgY2FzZXMgYWJvdmUpIHRoZW4gdGhlIHBhcmVudCB0aW1lbGluZSB3aWxsIGF0dGVtcHQgdG9cbiAqIG1lcmdlIHRoZSBzdHlsZXMgdXNlZCB3aXRoaW4gdGhlIHN1YiB0aW1lbGluZXMgaW50byBpdHNlbGYgKG9ubHkgd2l0aCBncm91cCgpIHRoaXMgd2lsbCBoYXBwZW4pLlxuICogVGhpcyBoYXBwZW5zIHdpdGggYSBtZXJnZSBvcGVyYXRpb24gKG11Y2ggbGlrZSBob3cgdGhlIG1lcmdlIHdvcmtzIGluIG1lcmdlU29ydCkgYW5kIGl0IHdpbGwgb25seVxuICogY29weSB0aGUgbW9zdCByZWNlbnRseSB1c2VkIHN0eWxlcyBmcm9tIHRoZSBzdWIgdGltZWxpbmVzIGludG8gdGhlIHBhcmVudCB0aW1lbGluZS4gVGhpcyBlbnN1cmVzXG4gKiB0aGF0IGlmIHRoZSBzdHlsZXMgYXJlIHVzZWQgbGF0ZXIgb24gaW4gYW5vdGhlciBwaGFzZSBvZiB0aGUgYW5pbWF0aW9uIHRoZW4gdGhleSB3aWxsIGJlIHRoZSBtb3N0XG4gKiB1cC10by1kYXRlIHZhbHVlcy5cbiAqXG4gKiBbSG93IE1pc3NpbmcgU3R5bGVzIEFyZSBVcGRhdGVkXVxuICogRWFjaCB0aW1lbGluZSBoYXMgYSBgYmFja0ZpbGxgIHByb3BlcnR5IHdoaWNoIGlzIHJlc3BvbnNpYmxlIGZvciBmaWxsaW5nIGluIG5ldyBzdHlsZXMgaW50b1xuICogYWxyZWFkeSBwcm9jZXNzZWQga2V5ZnJhbWVzIGlmIGEgbmV3IHN0eWxlIHNob3dzIHVwIGxhdGVyIHdpdGhpbiB0aGUgYW5pbWF0aW9uIHNlcXVlbmNlLlxuICpcbiAqIGBgYFxuICogc2VxdWVuY2UoW1xuICogICBzdHlsZSh7IHdpZHRoOiAwIH0pLFxuICogICBhbmltYXRlKDEwMDAsIHN0eWxlKHsgd2lkdGg6IDEwMCB9KSksXG4gKiAgIGFuaW1hdGUoMTAwMCwgc3R5bGUoeyB3aWR0aDogMjAwIH0pKSxcbiAqICAgYW5pbWF0ZSgxMDAwLCBzdHlsZSh7IHdpZHRoOiAzMDAgfSkpXG4gKiAgIGFuaW1hdGUoMTAwMCwgc3R5bGUoeyB3aWR0aDogNDAwLCBoZWlnaHQ6IDQwMCB9KSkgLy8gbm90aWNlIGhvdyBgaGVpZ2h0YCBkb2Vzbid0IGV4aXN0IGFueXdoZXJlXG4gKiBlbHNlXG4gKiBdKVxuICogYGBgXG4gKlxuICogV2hhdCBpcyBoYXBwZW5pbmcgaGVyZSBpcyB0aGF0IHRoZSBgaGVpZ2h0YCB2YWx1ZSBpcyBhZGRlZCBsYXRlciBpbiB0aGUgc2VxdWVuY2UsIGJ1dCBpcyBtaXNzaW5nXG4gKiBmcm9tIGFsbCBwcmV2aW91cyBhbmltYXRpb24gc3RlcHMuIFRoZXJlZm9yZSB3aGVuIGEga2V5ZnJhbWUgaXMgY3JlYXRlZCBpdCB3b3VsZCBhbHNvIGJlIG1pc3NpbmdcbiAqIGZyb20gYWxsIHByZXZpb3VzIGtleWZyYW1lcyB1cCB1bnRpbCB3aGVyZSBpdCBpcyBmaXJzdCB1c2VkLiBGb3IgdGhlIHRpbWVsaW5lIGtleWZyYW1lIGdlbmVyYXRpb25cbiAqIHRvIHByb3Blcmx5IGZpbGwgaW4gdGhlIHN0eWxlIGl0IHdpbGwgcGxhY2UgdGhlIHByZXZpb3VzIHZhbHVlICh0aGUgdmFsdWUgZnJvbSB0aGUgcGFyZW50XG4gKiB0aW1lbGluZSkgb3IgYSBkZWZhdWx0IHZhbHVlIG9mIGAqYCBpbnRvIHRoZSBiYWNrRmlsbCBtYXAuXG4gKlxuICogV2hlbiBhIHN1Yi10aW1lbGluZSBpcyBjcmVhdGVkIGl0IHdpbGwgaGF2ZSBpdHMgb3duIGJhY2tGaWxsIHByb3BlcnR5LiBUaGlzIGlzIGRvbmUgc28gdGhhdFxuICogc3R5bGVzIHByZXNlbnQgd2l0aGluIHRoZSBzdWItdGltZWxpbmUgZG8gbm90IGFjY2lkZW50YWxseSBzZWVwIGludG8gdGhlIHByZXZpb3VzL2Z1dHVyZSB0aW1lbGluZVxuICoga2V5ZnJhbWVzXG4gKlxuICogW1ZhbGlkYXRpb25dXG4gKiBUaGUgY29kZSBpbiB0aGlzIGZpbGUgaXMgbm90IHJlc3BvbnNpYmxlIGZvciB2YWxpZGF0aW9uLiBUaGF0IGZ1bmN0aW9uYWxpdHkgaGFwcGVucyB3aXRoIHdpdGhpblxuICogdGhlIGBBbmltYXRpb25WYWxpZGF0b3JWaXNpdG9yYCBjb2RlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRBbmltYXRpb25UaW1lbGluZXMoXG4gIGRyaXZlcjogQW5pbWF0aW9uRHJpdmVyLFxuICByb290RWxlbWVudDogYW55LFxuICBhc3Q6IEFzdDxBbmltYXRpb25NZXRhZGF0YVR5cGU+LFxuICBlbnRlckNsYXNzTmFtZTogc3RyaW5nLFxuICBsZWF2ZUNsYXNzTmFtZTogc3RyaW5nLFxuICBzdGFydGluZ1N0eWxlczogybVTdHlsZURhdGFNYXAgPSBuZXcgTWFwKCksXG4gIGZpbmFsU3R5bGVzOiDJtVN0eWxlRGF0YU1hcCA9IG5ldyBNYXAoKSxcbiAgb3B0aW9uczogQW5pbWF0aW9uT3B0aW9ucyxcbiAgc3ViSW5zdHJ1Y3Rpb25zPzogRWxlbWVudEluc3RydWN0aW9uTWFwLFxuICBlcnJvcnM6IEVycm9yW10gPSBbXSxcbik6IEFuaW1hdGlvblRpbWVsaW5lSW5zdHJ1Y3Rpb25bXSB7XG4gIHJldHVybiBuZXcgQW5pbWF0aW9uVGltZWxpbmVCdWlsZGVyVmlzaXRvcigpLmJ1aWxkS2V5ZnJhbWVzKFxuICAgIGRyaXZlcixcbiAgICByb290RWxlbWVudCxcbiAgICBhc3QsXG4gICAgZW50ZXJDbGFzc05hbWUsXG4gICAgbGVhdmVDbGFzc05hbWUsXG4gICAgc3RhcnRpbmdTdHlsZXMsXG4gICAgZmluYWxTdHlsZXMsXG4gICAgb3B0aW9ucyxcbiAgICBzdWJJbnN0cnVjdGlvbnMsXG4gICAgZXJyb3JzLFxuICApO1xufVxuXG5leHBvcnQgY2xhc3MgQW5pbWF0aW9uVGltZWxpbmVCdWlsZGVyVmlzaXRvciBpbXBsZW1lbnRzIEFzdFZpc2l0b3Ige1xuICBidWlsZEtleWZyYW1lcyhcbiAgICBkcml2ZXI6IEFuaW1hdGlvbkRyaXZlcixcbiAgICByb290RWxlbWVudDogYW55LFxuICAgIGFzdDogQXN0PEFuaW1hdGlvbk1ldGFkYXRhVHlwZT4sXG4gICAgZW50ZXJDbGFzc05hbWU6IHN0cmluZyxcbiAgICBsZWF2ZUNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHN0YXJ0aW5nU3R5bGVzOiDJtVN0eWxlRGF0YU1hcCxcbiAgICBmaW5hbFN0eWxlczogybVTdHlsZURhdGFNYXAsXG4gICAgb3B0aW9uczogQW5pbWF0aW9uT3B0aW9ucyxcbiAgICBzdWJJbnN0cnVjdGlvbnM/OiBFbGVtZW50SW5zdHJ1Y3Rpb25NYXAsXG4gICAgZXJyb3JzOiBFcnJvcltdID0gW10sXG4gICk6IEFuaW1hdGlvblRpbWVsaW5lSW5zdHJ1Y3Rpb25bXSB7XG4gICAgc3ViSW5zdHJ1Y3Rpb25zID0gc3ViSW5zdHJ1Y3Rpb25zIHx8IG5ldyBFbGVtZW50SW5zdHJ1Y3Rpb25NYXAoKTtcbiAgICBjb25zdCBjb250ZXh0ID0gbmV3IEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dChcbiAgICAgIGRyaXZlcixcbiAgICAgIHJvb3RFbGVtZW50LFxuICAgICAgc3ViSW5zdHJ1Y3Rpb25zLFxuICAgICAgZW50ZXJDbGFzc05hbWUsXG4gICAgICBsZWF2ZUNsYXNzTmFtZSxcbiAgICAgIGVycm9ycyxcbiAgICAgIFtdLFxuICAgICk7XG4gICAgY29udGV4dC5vcHRpb25zID0gb3B0aW9ucztcbiAgICBjb25zdCBkZWxheSA9IG9wdGlvbnMuZGVsYXkgPyByZXNvbHZlVGltaW5nVmFsdWUob3B0aW9ucy5kZWxheSkgOiAwO1xuICAgIGNvbnRleHQuY3VycmVudFRpbWVsaW5lLmRlbGF5TmV4dFN0ZXAoZGVsYXkpO1xuICAgIGNvbnRleHQuY3VycmVudFRpbWVsaW5lLnNldFN0eWxlcyhbc3RhcnRpbmdTdHlsZXNdLCBudWxsLCBjb250ZXh0LmVycm9ycywgb3B0aW9ucyk7XG5cbiAgICB2aXNpdERzbE5vZGUodGhpcywgYXN0LCBjb250ZXh0KTtcblxuICAgIC8vIHRoaXMgY2hlY2tzIHRvIHNlZSBpZiBhbiBhY3R1YWwgYW5pbWF0aW9uIGhhcHBlbmVkXG4gICAgY29uc3QgdGltZWxpbmVzID0gY29udGV4dC50aW1lbGluZXMuZmlsdGVyKCh0aW1lbGluZSkgPT4gdGltZWxpbmUuY29udGFpbnNBbmltYXRpb24oKSk7XG5cbiAgICAvLyBub3RlOiB3ZSBqdXN0IHdhbnQgdG8gYXBwbHkgdGhlIGZpbmFsIHN0eWxlcyBmb3IgdGhlIHJvb3RFbGVtZW50LCBzbyB3ZSBkbyBub3RcbiAgICAvLyAgICAgICBqdXN0IGFwcGx5IHRoZSBzdHlsZXMgdG8gdGhlIGxhc3QgdGltZWxpbmUgYnV0IHRoZSBsYXN0IHRpbWVsaW5lIHdoaWNoXG4gICAgLy8gICAgICAgZWxlbWVudCBpcyB0aGUgcm9vdCBvbmUgKGJhc2ljYWxseSBgKmAtc3R5bGVzIGFyZSByZXBsYWNlZCB3aXRoIHRoZSBhY3R1YWxcbiAgICAvLyAgICAgICBzdGF0ZSBzdHlsZSB2YWx1ZXMgb25seSBmb3IgdGhlIHJvb3QgZWxlbWVudClcbiAgICBpZiAodGltZWxpbmVzLmxlbmd0aCAmJiBmaW5hbFN0eWxlcy5zaXplKSB7XG4gICAgICBsZXQgbGFzdFJvb3RUaW1lbGluZTogVGltZWxpbmVCdWlsZGVyIHwgdW5kZWZpbmVkO1xuICAgICAgZm9yIChsZXQgaSA9IHRpbWVsaW5lcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBjb25zdCB0aW1lbGluZSA9IHRpbWVsaW5lc1tpXTtcbiAgICAgICAgaWYgKHRpbWVsaW5lLmVsZW1lbnQgPT09IHJvb3RFbGVtZW50KSB7XG4gICAgICAgICAgbGFzdFJvb3RUaW1lbGluZSA9IHRpbWVsaW5lO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAobGFzdFJvb3RUaW1lbGluZSAmJiAhbGFzdFJvb3RUaW1lbGluZS5hbGxvd09ubHlUaW1lbGluZVN0eWxlcygpKSB7XG4gICAgICAgIGxhc3RSb290VGltZWxpbmUuc2V0U3R5bGVzKFtmaW5hbFN0eWxlc10sIG51bGwsIGNvbnRleHQuZXJyb3JzLCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRpbWVsaW5lcy5sZW5ndGhcbiAgICAgID8gdGltZWxpbmVzLm1hcCgodGltZWxpbmUpID0+IHRpbWVsaW5lLmJ1aWxkS2V5ZnJhbWVzKCkpXG4gICAgICA6IFtjcmVhdGVUaW1lbGluZUluc3RydWN0aW9uKHJvb3RFbGVtZW50LCBbXSwgW10sIFtdLCAwLCBkZWxheSwgJycsIGZhbHNlKV07XG4gIH1cblxuICB2aXNpdFRyaWdnZXIoYXN0OiBUcmlnZ2VyQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpOiBhbnkge1xuICAgIC8vIHRoZXNlIHZhbHVlcyBhcmUgbm90IHZpc2l0ZWQgaW4gdGhpcyBBU1RcbiAgfVxuXG4gIHZpc2l0U3RhdGUoYXN0OiBTdGF0ZUFzdCwgY29udGV4dDogQW5pbWF0aW9uVGltZWxpbmVDb250ZXh0KTogYW55IHtcbiAgICAvLyB0aGVzZSB2YWx1ZXMgYXJlIG5vdCB2aXNpdGVkIGluIHRoaXMgQVNUXG4gIH1cblxuICB2aXNpdFRyYW5zaXRpb24oYXN0OiBUcmFuc2l0aW9uQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpOiBhbnkge1xuICAgIC8vIHRoZXNlIHZhbHVlcyBhcmUgbm90IHZpc2l0ZWQgaW4gdGhpcyBBU1RcbiAgfVxuXG4gIHZpc2l0QW5pbWF0ZUNoaWxkKGFzdDogQW5pbWF0ZUNoaWxkQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGVsZW1lbnRJbnN0cnVjdGlvbnMgPSBjb250ZXh0LnN1Ykluc3RydWN0aW9ucy5nZXQoY29udGV4dC5lbGVtZW50KTtcbiAgICBpZiAoZWxlbWVudEluc3RydWN0aW9ucykge1xuICAgICAgY29uc3QgaW5uZXJDb250ZXh0ID0gY29udGV4dC5jcmVhdGVTdWJDb250ZXh0KGFzdC5vcHRpb25zKTtcbiAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IGNvbnRleHQuY3VycmVudFRpbWVsaW5lLmN1cnJlbnRUaW1lO1xuICAgICAgY29uc3QgZW5kVGltZSA9IHRoaXMuX3Zpc2l0U3ViSW5zdHJ1Y3Rpb25zKFxuICAgICAgICBlbGVtZW50SW5zdHJ1Y3Rpb25zLFxuICAgICAgICBpbm5lckNvbnRleHQsXG4gICAgICAgIGlubmVyQ29udGV4dC5vcHRpb25zIGFzIEFuaW1hdGVDaGlsZE9wdGlvbnMsXG4gICAgICApO1xuICAgICAgaWYgKHN0YXJ0VGltZSAhPSBlbmRUaW1lKSB7XG4gICAgICAgIC8vIHdlIGRvIHRoaXMgb24gdGhlIHVwcGVyIGNvbnRleHQgYmVjYXVzZSB3ZSBjcmVhdGVkIGEgc3ViIGNvbnRleHQgZm9yXG4gICAgICAgIC8vIHRoZSBzdWIgY2hpbGQgYW5pbWF0aW9uc1xuICAgICAgICBjb250ZXh0LnRyYW5zZm9ybUludG9OZXdUaW1lbGluZShlbmRUaW1lKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29udGV4dC5wcmV2aW91c05vZGUgPSBhc3Q7XG4gIH1cblxuICB2aXNpdEFuaW1hdGVSZWYoYXN0OiBBbmltYXRlUmVmQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IGlubmVyQ29udGV4dCA9IGNvbnRleHQuY3JlYXRlU3ViQ29udGV4dChhc3Qub3B0aW9ucyk7XG4gICAgaW5uZXJDb250ZXh0LnRyYW5zZm9ybUludG9OZXdUaW1lbGluZSgpO1xuICAgIHRoaXMuX2FwcGx5QW5pbWF0aW9uUmVmRGVsYXlzKFthc3Qub3B0aW9ucywgYXN0LmFuaW1hdGlvbi5vcHRpb25zXSwgY29udGV4dCwgaW5uZXJDb250ZXh0KTtcbiAgICB0aGlzLnZpc2l0UmVmZXJlbmNlKGFzdC5hbmltYXRpb24sIGlubmVyQ29udGV4dCk7XG4gICAgY29udGV4dC50cmFuc2Zvcm1JbnRvTmV3VGltZWxpbmUoaW5uZXJDb250ZXh0LmN1cnJlbnRUaW1lbGluZS5jdXJyZW50VGltZSk7XG4gICAgY29udGV4dC5wcmV2aW91c05vZGUgPSBhc3Q7XG4gIH1cblxuICBwcml2YXRlIF9hcHBseUFuaW1hdGlvblJlZkRlbGF5cyhcbiAgICBhbmltYXRpb25zUmVmc09wdGlvbnM6IChBbmltYXRpb25PcHRpb25zIHwgbnVsbClbXSxcbiAgICBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQsXG4gICAgaW5uZXJDb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQsXG4gICkge1xuICAgIGZvciAoY29uc3QgYW5pbWF0aW9uUmVmT3B0aW9ucyBvZiBhbmltYXRpb25zUmVmc09wdGlvbnMpIHtcbiAgICAgIGNvbnN0IGFuaW1hdGlvbkRlbGF5ID0gYW5pbWF0aW9uUmVmT3B0aW9ucz8uZGVsYXk7XG4gICAgICBpZiAoYW5pbWF0aW9uRGVsYXkpIHtcbiAgICAgICAgY29uc3QgYW5pbWF0aW9uRGVsYXlWYWx1ZSA9XG4gICAgICAgICAgdHlwZW9mIGFuaW1hdGlvbkRlbGF5ID09PSAnbnVtYmVyJ1xuICAgICAgICAgICAgPyBhbmltYXRpb25EZWxheVxuICAgICAgICAgICAgOiByZXNvbHZlVGltaW5nVmFsdWUoXG4gICAgICAgICAgICAgICAgaW50ZXJwb2xhdGVQYXJhbXMoXG4gICAgICAgICAgICAgICAgICBhbmltYXRpb25EZWxheSxcbiAgICAgICAgICAgICAgICAgIGFuaW1hdGlvblJlZk9wdGlvbnM/LnBhcmFtcyA/PyB7fSxcbiAgICAgICAgICAgICAgICAgIGNvbnRleHQuZXJyb3JzLFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgIGlubmVyQ29udGV4dC5kZWxheU5leHRTdGVwKGFuaW1hdGlvbkRlbGF5VmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0U3ViSW5zdHJ1Y3Rpb25zKFxuICAgIGluc3RydWN0aW9uczogQW5pbWF0aW9uVGltZWxpbmVJbnN0cnVjdGlvbltdLFxuICAgIGNvbnRleHQ6IEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dCxcbiAgICBvcHRpb25zOiBBbmltYXRlQ2hpbGRPcHRpb25zLFxuICApOiBudW1iZXIge1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IGNvbnRleHQuY3VycmVudFRpbWVsaW5lLmN1cnJlbnRUaW1lO1xuICAgIGxldCBmdXJ0aGVzdFRpbWUgPSBzdGFydFRpbWU7XG5cbiAgICAvLyB0aGlzIGlzIGEgc3BlY2lhbC1jYXNlIGZvciB3aGVuIGEgdXNlciB3YW50cyB0byBza2lwIGEgc3ViXG4gICAgLy8gYW5pbWF0aW9uIGZyb20gYmVpbmcgZmlyZWQgZW50aXJlbHkuXG4gICAgY29uc3QgZHVyYXRpb24gPSBvcHRpb25zLmR1cmF0aW9uICE9IG51bGwgPyByZXNvbHZlVGltaW5nVmFsdWUob3B0aW9ucy5kdXJhdGlvbikgOiBudWxsO1xuICAgIGNvbnN0IGRlbGF5ID0gb3B0aW9ucy5kZWxheSAhPSBudWxsID8gcmVzb2x2ZVRpbWluZ1ZhbHVlKG9wdGlvbnMuZGVsYXkpIDogbnVsbDtcbiAgICBpZiAoZHVyYXRpb24gIT09IDApIHtcbiAgICAgIGluc3RydWN0aW9ucy5mb3JFYWNoKChpbnN0cnVjdGlvbikgPT4ge1xuICAgICAgICBjb25zdCBpbnN0cnVjdGlvblRpbWluZ3MgPSBjb250ZXh0LmFwcGVuZEluc3RydWN0aW9uVG9UaW1lbGluZShcbiAgICAgICAgICBpbnN0cnVjdGlvbixcbiAgICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgICBkZWxheSxcbiAgICAgICAgKTtcbiAgICAgICAgZnVydGhlc3RUaW1lID0gTWF0aC5tYXgoXG4gICAgICAgICAgZnVydGhlc3RUaW1lLFxuICAgICAgICAgIGluc3RydWN0aW9uVGltaW5ncy5kdXJhdGlvbiArIGluc3RydWN0aW9uVGltaW5ncy5kZWxheSxcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBmdXJ0aGVzdFRpbWU7XG4gIH1cblxuICB2aXNpdFJlZmVyZW5jZShhc3Q6IFJlZmVyZW5jZUFzdCwgY29udGV4dDogQW5pbWF0aW9uVGltZWxpbmVDb250ZXh0KSB7XG4gICAgY29udGV4dC51cGRhdGVPcHRpb25zKGFzdC5vcHRpb25zLCB0cnVlKTtcbiAgICB2aXNpdERzbE5vZGUodGhpcywgYXN0LmFuaW1hdGlvbiwgY29udGV4dCk7XG4gICAgY29udGV4dC5wcmV2aW91c05vZGUgPSBhc3Q7XG4gIH1cblxuICB2aXNpdFNlcXVlbmNlKGFzdDogU2VxdWVuY2VBc3QsIGNvbnRleHQ6IEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dCkge1xuICAgIGNvbnN0IHN1YkNvbnRleHRDb3VudCA9IGNvbnRleHQuc3ViQ29udGV4dENvdW50O1xuICAgIGxldCBjdHggPSBjb250ZXh0O1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhc3Qub3B0aW9ucztcblxuICAgIGlmIChvcHRpb25zICYmIChvcHRpb25zLnBhcmFtcyB8fCBvcHRpb25zLmRlbGF5KSkge1xuICAgICAgY3R4ID0gY29udGV4dC5jcmVhdGVTdWJDb250ZXh0KG9wdGlvbnMpO1xuICAgICAgY3R4LnRyYW5zZm9ybUludG9OZXdUaW1lbGluZSgpO1xuXG4gICAgICBpZiAob3B0aW9ucy5kZWxheSAhPSBudWxsKSB7XG4gICAgICAgIGlmIChjdHgucHJldmlvdXNOb2RlLnR5cGUgPT0gQW5pbWF0aW9uTWV0YWRhdGFUeXBlLlN0eWxlKSB7XG4gICAgICAgICAgY3R4LmN1cnJlbnRUaW1lbGluZS5zbmFwc2hvdEN1cnJlbnRTdHlsZXMoKTtcbiAgICAgICAgICBjdHgucHJldmlvdXNOb2RlID0gREVGQVVMVF9OT09QX1BSRVZJT1VTX05PREU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWxheSA9IHJlc29sdmVUaW1pbmdWYWx1ZShvcHRpb25zLmRlbGF5KTtcbiAgICAgICAgY3R4LmRlbGF5TmV4dFN0ZXAoZGVsYXkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChhc3Quc3RlcHMubGVuZ3RoKSB7XG4gICAgICBhc3Quc3RlcHMuZm9yRWFjaCgocykgPT4gdmlzaXREc2xOb2RlKHRoaXMsIHMsIGN0eCkpO1xuXG4gICAgICAvLyB0aGlzIGlzIGhlcmUganVzdCBpbiBjYXNlIHRoZSBpbm5lciBzdGVwcyBvbmx5IGNvbnRhaW4gb3IgZW5kIHdpdGggYSBzdHlsZSgpIGNhbGxcbiAgICAgIGN0eC5jdXJyZW50VGltZWxpbmUuYXBwbHlTdHlsZXNUb0tleWZyYW1lKCk7XG5cbiAgICAgIC8vIHRoaXMgbWVhbnMgdGhhdCBzb21lIGFuaW1hdGlvbiBmdW5jdGlvbiB3aXRoaW4gdGhlIHNlcXVlbmNlXG4gICAgICAvLyBlbmRlZCB1cCBjcmVhdGluZyBhIHN1YiB0aW1lbGluZSAod2hpY2ggbWVhbnMgdGhlIGN1cnJlbnRcbiAgICAgIC8vIHRpbWVsaW5lIGNhbm5vdCBvdmVybGFwIHdpdGggdGhlIGNvbnRlbnRzIG9mIHRoZSBzZXF1ZW5jZSlcbiAgICAgIGlmIChjdHguc3ViQ29udGV4dENvdW50ID4gc3ViQ29udGV4dENvdW50KSB7XG4gICAgICAgIGN0eC50cmFuc2Zvcm1JbnRvTmV3VGltZWxpbmUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb250ZXh0LnByZXZpb3VzTm9kZSA9IGFzdDtcbiAgfVxuXG4gIHZpc2l0R3JvdXAoYXN0OiBHcm91cEFzdCwgY29udGV4dDogQW5pbWF0aW9uVGltZWxpbmVDb250ZXh0KSB7XG4gICAgY29uc3QgaW5uZXJUaW1lbGluZXM6IFRpbWVsaW5lQnVpbGRlcltdID0gW107XG4gICAgbGV0IGZ1cnRoZXN0VGltZSA9IGNvbnRleHQuY3VycmVudFRpbWVsaW5lLmN1cnJlbnRUaW1lO1xuICAgIGNvbnN0IGRlbGF5ID0gYXN0Lm9wdGlvbnMgJiYgYXN0Lm9wdGlvbnMuZGVsYXkgPyByZXNvbHZlVGltaW5nVmFsdWUoYXN0Lm9wdGlvbnMuZGVsYXkpIDogMDtcblxuICAgIGFzdC5zdGVwcy5mb3JFYWNoKChzKSA9PiB7XG4gICAgICBjb25zdCBpbm5lckNvbnRleHQgPSBjb250ZXh0LmNyZWF0ZVN1YkNvbnRleHQoYXN0Lm9wdGlvbnMpO1xuICAgICAgaWYgKGRlbGF5KSB7XG4gICAgICAgIGlubmVyQ29udGV4dC5kZWxheU5leHRTdGVwKGRlbGF5KTtcbiAgICAgIH1cblxuICAgICAgdmlzaXREc2xOb2RlKHRoaXMsIHMsIGlubmVyQ29udGV4dCk7XG4gICAgICBmdXJ0aGVzdFRpbWUgPSBNYXRoLm1heChmdXJ0aGVzdFRpbWUsIGlubmVyQ29udGV4dC5jdXJyZW50VGltZWxpbmUuY3VycmVudFRpbWUpO1xuICAgICAgaW5uZXJUaW1lbGluZXMucHVzaChpbm5lckNvbnRleHQuY3VycmVudFRpbWVsaW5lKTtcbiAgICB9KTtcblxuICAgIC8vIHRoaXMgb3BlcmF0aW9uIGlzIHJ1biBhZnRlciB0aGUgQVNUIGxvb3AgYmVjYXVzZSBvdGhlcndpc2VcbiAgICAvLyBpZiB0aGUgcGFyZW50IHRpbWVsaW5lJ3MgY29sbGVjdGVkIHN0eWxlcyB3ZXJlIHVwZGF0ZWQgdGhlblxuICAgIC8vIGl0IHdvdWxkIHBhc3MgaW4gaW52YWxpZCBkYXRhIGludG8gdGhlIG5ldy10by1iZSBmb3JrZWQgaXRlbXNcbiAgICBpbm5lclRpbWVsaW5lcy5mb3JFYWNoKCh0aW1lbGluZSkgPT5cbiAgICAgIGNvbnRleHQuY3VycmVudFRpbWVsaW5lLm1lcmdlVGltZWxpbmVDb2xsZWN0ZWRTdHlsZXModGltZWxpbmUpLFxuICAgICk7XG4gICAgY29udGV4dC50cmFuc2Zvcm1JbnRvTmV3VGltZWxpbmUoZnVydGhlc3RUaW1lKTtcbiAgICBjb250ZXh0LnByZXZpb3VzTm9kZSA9IGFzdDtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0VGltaW5nKGFzdDogVGltaW5nQXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpOiBBbmltYXRlVGltaW5ncyB7XG4gICAgaWYgKChhc3QgYXMgRHluYW1pY1RpbWluZ0FzdCkuZHluYW1pYykge1xuICAgICAgY29uc3Qgc3RyVmFsdWUgPSAoYXN0IGFzIER5bmFtaWNUaW1pbmdBc3QpLnN0clZhbHVlO1xuICAgICAgY29uc3QgdGltaW5nVmFsdWUgPSBjb250ZXh0LnBhcmFtc1xuICAgICAgICA/IGludGVycG9sYXRlUGFyYW1zKHN0clZhbHVlLCBjb250ZXh0LnBhcmFtcywgY29udGV4dC5lcnJvcnMpXG4gICAgICAgIDogc3RyVmFsdWU7XG4gICAgICByZXR1cm4gcmVzb2x2ZVRpbWluZyh0aW1pbmdWYWx1ZSwgY29udGV4dC5lcnJvcnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge2R1cmF0aW9uOiBhc3QuZHVyYXRpb24sIGRlbGF5OiBhc3QuZGVsYXksIGVhc2luZzogYXN0LmVhc2luZ307XG4gICAgfVxuICB9XG5cbiAgdmlzaXRBbmltYXRlKGFzdDogQW5pbWF0ZUFzdCwgY29udGV4dDogQW5pbWF0aW9uVGltZWxpbmVDb250ZXh0KSB7XG4gICAgY29uc3QgdGltaW5ncyA9IChjb250ZXh0LmN1cnJlbnRBbmltYXRlVGltaW5ncyA9IHRoaXMuX3Zpc2l0VGltaW5nKGFzdC50aW1pbmdzLCBjb250ZXh0KSk7XG4gICAgY29uc3QgdGltZWxpbmUgPSBjb250ZXh0LmN1cnJlbnRUaW1lbGluZTtcbiAgICBpZiAodGltaW5ncy5kZWxheSkge1xuICAgICAgY29udGV4dC5pbmNyZW1lbnRUaW1lKHRpbWluZ3MuZGVsYXkpO1xuICAgICAgdGltZWxpbmUuc25hcHNob3RDdXJyZW50U3R5bGVzKCk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3R5bGUgPSBhc3Quc3R5bGU7XG4gICAgaWYgKHN0eWxlLnR5cGUgPT0gQW5pbWF0aW9uTWV0YWRhdGFUeXBlLktleWZyYW1lcykge1xuICAgICAgdGhpcy52aXNpdEtleWZyYW1lcyhzdHlsZSwgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQuaW5jcmVtZW50VGltZSh0aW1pbmdzLmR1cmF0aW9uKTtcbiAgICAgIHRoaXMudmlzaXRTdHlsZShzdHlsZSBhcyBTdHlsZUFzdCwgY29udGV4dCk7XG4gICAgICB0aW1lbGluZS5hcHBseVN0eWxlc1RvS2V5ZnJhbWUoKTtcbiAgICB9XG5cbiAgICBjb250ZXh0LmN1cnJlbnRBbmltYXRlVGltaW5ncyA9IG51bGw7XG4gICAgY29udGV4dC5wcmV2aW91c05vZGUgPSBhc3Q7XG4gIH1cblxuICB2aXNpdFN0eWxlKGFzdDogU3R5bGVBc3QsIGNvbnRleHQ6IEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dCkge1xuICAgIGNvbnN0IHRpbWVsaW5lID0gY29udGV4dC5jdXJyZW50VGltZWxpbmU7XG4gICAgY29uc3QgdGltaW5ncyA9IGNvbnRleHQuY3VycmVudEFuaW1hdGVUaW1pbmdzITtcblxuICAgIC8vIHRoaXMgaXMgYSBzcGVjaWFsIGNhc2UgZm9yIHdoZW4gYSBzdHlsZSgpIGNhbGxcbiAgICAvLyBkaXJlY3RseSBmb2xsb3dzICBhbiBhbmltYXRlKCkgY2FsbCAoYnV0IG5vdCBpbnNpZGUgb2YgYW4gYW5pbWF0ZSgpIGNhbGwpXG4gICAgaWYgKCF0aW1pbmdzICYmIHRpbWVsaW5lLmhhc0N1cnJlbnRTdHlsZVByb3BlcnRpZXMoKSkge1xuICAgICAgdGltZWxpbmUuZm9yd2FyZEZyYW1lKCk7XG4gICAgfVxuXG4gICAgY29uc3QgZWFzaW5nID0gKHRpbWluZ3MgJiYgdGltaW5ncy5lYXNpbmcpIHx8IGFzdC5lYXNpbmc7XG4gICAgaWYgKGFzdC5pc0VtcHR5U3RlcCkge1xuICAgICAgdGltZWxpbmUuYXBwbHlFbXB0eVN0ZXAoZWFzaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGltZWxpbmUuc2V0U3R5bGVzKGFzdC5zdHlsZXMsIGVhc2luZywgY29udGV4dC5lcnJvcnMsIGNvbnRleHQub3B0aW9ucyk7XG4gICAgfVxuXG4gICAgY29udGV4dC5wcmV2aW91c05vZGUgPSBhc3Q7XG4gIH1cblxuICB2aXNpdEtleWZyYW1lcyhhc3Q6IEtleWZyYW1lc0FzdCwgY29udGV4dDogQW5pbWF0aW9uVGltZWxpbmVDb250ZXh0KSB7XG4gICAgY29uc3QgY3VycmVudEFuaW1hdGVUaW1pbmdzID0gY29udGV4dC5jdXJyZW50QW5pbWF0ZVRpbWluZ3MhO1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IGNvbnRleHQuY3VycmVudFRpbWVsaW5lIS5kdXJhdGlvbjtcbiAgICBjb25zdCBkdXJhdGlvbiA9IGN1cnJlbnRBbmltYXRlVGltaW5ncy5kdXJhdGlvbjtcbiAgICBjb25zdCBpbm5lckNvbnRleHQgPSBjb250ZXh0LmNyZWF0ZVN1YkNvbnRleHQoKTtcbiAgICBjb25zdCBpbm5lclRpbWVsaW5lID0gaW5uZXJDb250ZXh0LmN1cnJlbnRUaW1lbGluZTtcbiAgICBpbm5lclRpbWVsaW5lLmVhc2luZyA9IGN1cnJlbnRBbmltYXRlVGltaW5ncy5lYXNpbmc7XG5cbiAgICBhc3Quc3R5bGVzLmZvckVhY2goKHN0ZXApID0+IHtcbiAgICAgIGNvbnN0IG9mZnNldDogbnVtYmVyID0gc3RlcC5vZmZzZXQgfHwgMDtcbiAgICAgIGlubmVyVGltZWxpbmUuZm9yd2FyZFRpbWUob2Zmc2V0ICogZHVyYXRpb24pO1xuICAgICAgaW5uZXJUaW1lbGluZS5zZXRTdHlsZXMoc3RlcC5zdHlsZXMsIHN0ZXAuZWFzaW5nLCBjb250ZXh0LmVycm9ycywgY29udGV4dC5vcHRpb25zKTtcbiAgICAgIGlubmVyVGltZWxpbmUuYXBwbHlTdHlsZXNUb0tleWZyYW1lKCk7XG4gICAgfSk7XG5cbiAgICAvLyB0aGlzIHdpbGwgZW5zdXJlIHRoYXQgdGhlIHBhcmVudCB0aW1lbGluZSBnZXRzIGFsbCB0aGUgc3R5bGVzIGZyb21cbiAgICAvLyB0aGUgY2hpbGQgZXZlbiBpZiB0aGUgbmV3IHRpbWVsaW5lIGJlbG93IGlzIG5vdCB1c2VkXG4gICAgY29udGV4dC5jdXJyZW50VGltZWxpbmUubWVyZ2VUaW1lbGluZUNvbGxlY3RlZFN0eWxlcyhpbm5lclRpbWVsaW5lKTtcblxuICAgIC8vIHdlIGRvIHRoaXMgYmVjYXVzZSB0aGUgd2luZG93IGJldHdlZW4gdGhpcyB0aW1lbGluZSBhbmQgdGhlIHN1YiB0aW1lbGluZVxuICAgIC8vIHNob3VsZCBlbnN1cmUgdGhhdCB0aGUgc3R5bGVzIHdpdGhpbiBhcmUgZXhhY3RseSB0aGUgc2FtZSBhcyB0aGV5IHdlcmUgYmVmb3JlXG4gICAgY29udGV4dC50cmFuc2Zvcm1JbnRvTmV3VGltZWxpbmUoc3RhcnRUaW1lICsgZHVyYXRpb24pO1xuICAgIGNvbnRleHQucHJldmlvdXNOb2RlID0gYXN0O1xuICB9XG5cbiAgdmlzaXRRdWVyeShhc3Q6IFF1ZXJ5QXN0LCBjb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQpIHtcbiAgICAvLyBpbiB0aGUgZXZlbnQgdGhhdCB0aGUgZmlyc3Qgc3RlcCBiZWZvcmUgdGhpcyBpcyBhIHN0eWxlIHN0ZXAgd2UgbmVlZFxuICAgIC8vIHRvIGVuc3VyZSB0aGUgc3R5bGVzIGFyZSBhcHBsaWVkIGJlZm9yZSB0aGUgY2hpbGRyZW4gYXJlIGFuaW1hdGVkXG4gICAgY29uc3Qgc3RhcnRUaW1lID0gY29udGV4dC5jdXJyZW50VGltZWxpbmUuY3VycmVudFRpbWU7XG4gICAgY29uc3Qgb3B0aW9ucyA9IChhc3Qub3B0aW9ucyB8fCB7fSkgYXMgQW5pbWF0aW9uUXVlcnlPcHRpb25zO1xuICAgIGNvbnN0IGRlbGF5ID0gb3B0aW9ucy5kZWxheSA/IHJlc29sdmVUaW1pbmdWYWx1ZShvcHRpb25zLmRlbGF5KSA6IDA7XG5cbiAgICBpZiAoXG4gICAgICBkZWxheSAmJlxuICAgICAgKGNvbnRleHQucHJldmlvdXNOb2RlLnR5cGUgPT09IEFuaW1hdGlvbk1ldGFkYXRhVHlwZS5TdHlsZSB8fFxuICAgICAgICAoc3RhcnRUaW1lID09IDAgJiYgY29udGV4dC5jdXJyZW50VGltZWxpbmUuaGFzQ3VycmVudFN0eWxlUHJvcGVydGllcygpKSlcbiAgICApIHtcbiAgICAgIGNvbnRleHQuY3VycmVudFRpbWVsaW5lLnNuYXBzaG90Q3VycmVudFN0eWxlcygpO1xuICAgICAgY29udGV4dC5wcmV2aW91c05vZGUgPSBERUZBVUxUX05PT1BfUFJFVklPVVNfTk9ERTtcbiAgICB9XG5cbiAgICBsZXQgZnVydGhlc3RUaW1lID0gc3RhcnRUaW1lO1xuICAgIGNvbnN0IGVsbXMgPSBjb250ZXh0Lmludm9rZVF1ZXJ5KFxuICAgICAgYXN0LnNlbGVjdG9yLFxuICAgICAgYXN0Lm9yaWdpbmFsU2VsZWN0b3IsXG4gICAgICBhc3QubGltaXQsXG4gICAgICBhc3QuaW5jbHVkZVNlbGYsXG4gICAgICBvcHRpb25zLm9wdGlvbmFsID8gdHJ1ZSA6IGZhbHNlLFxuICAgICAgY29udGV4dC5lcnJvcnMsXG4gICAgKTtcblxuICAgIGNvbnRleHQuY3VycmVudFF1ZXJ5VG90YWwgPSBlbG1zLmxlbmd0aDtcbiAgICBsZXQgc2FtZUVsZW1lbnRUaW1lbGluZTogVGltZWxpbmVCdWlsZGVyIHwgbnVsbCA9IG51bGw7XG4gICAgZWxtcy5mb3JFYWNoKChlbGVtZW50LCBpKSA9PiB7XG4gICAgICBjb250ZXh0LmN1cnJlbnRRdWVyeUluZGV4ID0gaTtcbiAgICAgIGNvbnN0IGlubmVyQ29udGV4dCA9IGNvbnRleHQuY3JlYXRlU3ViQ29udGV4dChhc3Qub3B0aW9ucywgZWxlbWVudCk7XG4gICAgICBpZiAoZGVsYXkpIHtcbiAgICAgICAgaW5uZXJDb250ZXh0LmRlbGF5TmV4dFN0ZXAoZGVsYXkpO1xuICAgICAgfVxuXG4gICAgICBpZiAoZWxlbWVudCA9PT0gY29udGV4dC5lbGVtZW50KSB7XG4gICAgICAgIHNhbWVFbGVtZW50VGltZWxpbmUgPSBpbm5lckNvbnRleHQuY3VycmVudFRpbWVsaW5lO1xuICAgICAgfVxuXG4gICAgICB2aXNpdERzbE5vZGUodGhpcywgYXN0LmFuaW1hdGlvbiwgaW5uZXJDb250ZXh0KTtcblxuICAgICAgLy8gdGhpcyBpcyBoZXJlIGp1c3QgaW5jYXNlIHRoZSBpbm5lciBzdGVwcyBvbmx5IGNvbnRhaW4gb3IgZW5kXG4gICAgICAvLyB3aXRoIGEgc3R5bGUoKSBjYWxsICh3aGljaCBpcyBoZXJlIHRvIHNpZ25hbCB0aGF0IHRoaXMgaXMgYSBwcmVwYXJhdG9yeVxuICAgICAgLy8gY2FsbCB0byBzdHlsZSBhbiBlbGVtZW50IGJlZm9yZSBpdCBpcyBhbmltYXRlZCBhZ2FpbilcbiAgICAgIGlubmVyQ29udGV4dC5jdXJyZW50VGltZWxpbmUuYXBwbHlTdHlsZXNUb0tleWZyYW1lKCk7XG5cbiAgICAgIGNvbnN0IGVuZFRpbWUgPSBpbm5lckNvbnRleHQuY3VycmVudFRpbWVsaW5lLmN1cnJlbnRUaW1lO1xuICAgICAgZnVydGhlc3RUaW1lID0gTWF0aC5tYXgoZnVydGhlc3RUaW1lLCBlbmRUaW1lKTtcbiAgICB9KTtcblxuICAgIGNvbnRleHQuY3VycmVudFF1ZXJ5SW5kZXggPSAwO1xuICAgIGNvbnRleHQuY3VycmVudFF1ZXJ5VG90YWwgPSAwO1xuICAgIGNvbnRleHQudHJhbnNmb3JtSW50b05ld1RpbWVsaW5lKGZ1cnRoZXN0VGltZSk7XG5cbiAgICBpZiAoc2FtZUVsZW1lbnRUaW1lbGluZSkge1xuICAgICAgY29udGV4dC5jdXJyZW50VGltZWxpbmUubWVyZ2VUaW1lbGluZUNvbGxlY3RlZFN0eWxlcyhzYW1lRWxlbWVudFRpbWVsaW5lKTtcbiAgICAgIGNvbnRleHQuY3VycmVudFRpbWVsaW5lLnNuYXBzaG90Q3VycmVudFN0eWxlcygpO1xuICAgIH1cblxuICAgIGNvbnRleHQucHJldmlvdXNOb2RlID0gYXN0O1xuICB9XG5cbiAgdmlzaXRTdGFnZ2VyKGFzdDogU3RhZ2dlckFzdCwgY29udGV4dDogQW5pbWF0aW9uVGltZWxpbmVDb250ZXh0KSB7XG4gICAgY29uc3QgcGFyZW50Q29udGV4dCA9IGNvbnRleHQucGFyZW50Q29udGV4dCE7XG4gICAgY29uc3QgdGwgPSBjb250ZXh0LmN1cnJlbnRUaW1lbGluZTtcbiAgICBjb25zdCB0aW1pbmdzID0gYXN0LnRpbWluZ3M7XG4gICAgY29uc3QgZHVyYXRpb24gPSBNYXRoLmFicyh0aW1pbmdzLmR1cmF0aW9uKTtcbiAgICBjb25zdCBtYXhUaW1lID0gZHVyYXRpb24gKiAoY29udGV4dC5jdXJyZW50UXVlcnlUb3RhbCAtIDEpO1xuICAgIGxldCBkZWxheSA9IGR1cmF0aW9uICogY29udGV4dC5jdXJyZW50UXVlcnlJbmRleDtcblxuICAgIGxldCBzdGFnZ2VyVHJhbnNmb3JtZXIgPSB0aW1pbmdzLmR1cmF0aW9uIDwgMCA/ICdyZXZlcnNlJyA6IHRpbWluZ3MuZWFzaW5nO1xuICAgIHN3aXRjaCAoc3RhZ2dlclRyYW5zZm9ybWVyKSB7XG4gICAgICBjYXNlICdyZXZlcnNlJzpcbiAgICAgICAgZGVsYXkgPSBtYXhUaW1lIC0gZGVsYXk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZnVsbCc6XG4gICAgICAgIGRlbGF5ID0gcGFyZW50Q29udGV4dC5jdXJyZW50U3RhZ2dlclRpbWU7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGNvbnN0IHRpbWVsaW5lID0gY29udGV4dC5jdXJyZW50VGltZWxpbmU7XG4gICAgaWYgKGRlbGF5KSB7XG4gICAgICB0aW1lbGluZS5kZWxheU5leHRTdGVwKGRlbGF5KTtcbiAgICB9XG5cbiAgICBjb25zdCBzdGFydGluZ1RpbWUgPSB0aW1lbGluZS5jdXJyZW50VGltZTtcbiAgICB2aXNpdERzbE5vZGUodGhpcywgYXN0LmFuaW1hdGlvbiwgY29udGV4dCk7XG4gICAgY29udGV4dC5wcmV2aW91c05vZGUgPSBhc3Q7XG5cbiAgICAvLyB0aW1lID0gZHVyYXRpb24gKyBkZWxheVxuICAgIC8vIHRoZSByZWFzb24gd2h5IHRoaXMgY29tcHV0YXRpb24gaXMgc28gY29tcGxleCBpcyBiZWNhdXNlXG4gICAgLy8gdGhlIGlubmVyIHRpbWVsaW5lIG1heSBlaXRoZXIgaGF2ZSBhIGRlbGF5IHZhbHVlIG9yIGEgc3RyZXRjaGVkXG4gICAgLy8ga2V5ZnJhbWUgZGVwZW5kaW5nIG9uIGlmIGEgc3VidGltZWxpbmUgaXMgbm90IHVzZWQgb3IgaXMgdXNlZC5cbiAgICBwYXJlbnRDb250ZXh0LmN1cnJlbnRTdGFnZ2VyVGltZSA9XG4gICAgICB0bC5jdXJyZW50VGltZSAtIHN0YXJ0aW5nVGltZSArICh0bC5zdGFydFRpbWUgLSBwYXJlbnRDb250ZXh0LmN1cnJlbnRUaW1lbGluZS5zdGFydFRpbWUpO1xuICB9XG59XG5cbmV4cG9ydCBkZWNsYXJlIHR5cGUgU3R5bGVBdFRpbWUgPSB7XG4gIHRpbWU6IG51bWJlcjtcbiAgdmFsdWU6IHN0cmluZyB8IG51bWJlcjtcbn07XG5cbmNvbnN0IERFRkFVTFRfTk9PUF9QUkVWSU9VU19OT0RFID0gPEFzdDxBbmltYXRpb25NZXRhZGF0YVR5cGU+Pnt9O1xuZXhwb3J0IGNsYXNzIEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dCB7XG4gIHB1YmxpYyBwYXJlbnRDb250ZXh0OiBBbmltYXRpb25UaW1lbGluZUNvbnRleHQgfCBudWxsID0gbnVsbDtcbiAgcHVibGljIGN1cnJlbnRUaW1lbGluZTogVGltZWxpbmVCdWlsZGVyO1xuICBwdWJsaWMgY3VycmVudEFuaW1hdGVUaW1pbmdzOiBBbmltYXRlVGltaW5ncyB8IG51bGwgPSBudWxsO1xuICBwdWJsaWMgcHJldmlvdXNOb2RlOiBBc3Q8QW5pbWF0aW9uTWV0YWRhdGFUeXBlPiA9IERFRkFVTFRfTk9PUF9QUkVWSU9VU19OT0RFO1xuICBwdWJsaWMgc3ViQ29udGV4dENvdW50ID0gMDtcbiAgcHVibGljIG9wdGlvbnM6IEFuaW1hdGlvbk9wdGlvbnMgPSB7fTtcbiAgcHVibGljIGN1cnJlbnRRdWVyeUluZGV4OiBudW1iZXIgPSAwO1xuICBwdWJsaWMgY3VycmVudFF1ZXJ5VG90YWw6IG51bWJlciA9IDA7XG4gIHB1YmxpYyBjdXJyZW50U3RhZ2dlclRpbWU6IG51bWJlciA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBfZHJpdmVyOiBBbmltYXRpb25Ecml2ZXIsXG4gICAgcHVibGljIGVsZW1lbnQ6IGFueSxcbiAgICBwdWJsaWMgc3ViSW5zdHJ1Y3Rpb25zOiBFbGVtZW50SW5zdHJ1Y3Rpb25NYXAsXG4gICAgcHJpdmF0ZSBfZW50ZXJDbGFzc05hbWU6IHN0cmluZyxcbiAgICBwcml2YXRlIF9sZWF2ZUNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHB1YmxpYyBlcnJvcnM6IEVycm9yW10sXG4gICAgcHVibGljIHRpbWVsaW5lczogVGltZWxpbmVCdWlsZGVyW10sXG4gICAgaW5pdGlhbFRpbWVsaW5lPzogVGltZWxpbmVCdWlsZGVyLFxuICApIHtcbiAgICB0aGlzLmN1cnJlbnRUaW1lbGluZSA9IGluaXRpYWxUaW1lbGluZSB8fCBuZXcgVGltZWxpbmVCdWlsZGVyKHRoaXMuX2RyaXZlciwgZWxlbWVudCwgMCk7XG4gICAgdGltZWxpbmVzLnB1c2godGhpcy5jdXJyZW50VGltZWxpbmUpO1xuICB9XG5cbiAgZ2V0IHBhcmFtcygpIHtcbiAgICByZXR1cm4gdGhpcy5vcHRpb25zLnBhcmFtcztcbiAgfVxuXG4gIHVwZGF0ZU9wdGlvbnMob3B0aW9uczogQW5pbWF0aW9uT3B0aW9ucyB8IG51bGwsIHNraXBJZkV4aXN0cz86IGJvb2xlYW4pIHtcbiAgICBpZiAoIW9wdGlvbnMpIHJldHVybjtcblxuICAgIGNvbnN0IG5ld09wdGlvbnMgPSBvcHRpb25zIGFzIGFueTtcbiAgICBsZXQgb3B0aW9uc1RvVXBkYXRlID0gdGhpcy5vcHRpb25zO1xuXG4gICAgLy8gTk9URTogdGhpcyB3aWxsIGdldCBwYXRjaGVkIHVwIHdoZW4gb3RoZXIgYW5pbWF0aW9uIG1ldGhvZHMgc3VwcG9ydCBkdXJhdGlvbiBvdmVycmlkZXNcbiAgICBpZiAobmV3T3B0aW9ucy5kdXJhdGlvbiAhPSBudWxsKSB7XG4gICAgICAob3B0aW9uc1RvVXBkYXRlIGFzIGFueSkuZHVyYXRpb24gPSByZXNvbHZlVGltaW5nVmFsdWUobmV3T3B0aW9ucy5kdXJhdGlvbik7XG4gICAgfVxuXG4gICAgaWYgKG5ld09wdGlvbnMuZGVsYXkgIT0gbnVsbCkge1xuICAgICAgb3B0aW9uc1RvVXBkYXRlLmRlbGF5ID0gcmVzb2x2ZVRpbWluZ1ZhbHVlKG5ld09wdGlvbnMuZGVsYXkpO1xuICAgIH1cblxuICAgIGNvbnN0IG5ld1BhcmFtcyA9IG5ld09wdGlvbnMucGFyYW1zO1xuICAgIGlmIChuZXdQYXJhbXMpIHtcbiAgICAgIGxldCBwYXJhbXNUb1VwZGF0ZToge1tuYW1lOiBzdHJpbmddOiBhbnl9ID0gb3B0aW9uc1RvVXBkYXRlLnBhcmFtcyE7XG4gICAgICBpZiAoIXBhcmFtc1RvVXBkYXRlKSB7XG4gICAgICAgIHBhcmFtc1RvVXBkYXRlID0gdGhpcy5vcHRpb25zLnBhcmFtcyA9IHt9O1xuICAgICAgfVxuXG4gICAgICBPYmplY3Qua2V5cyhuZXdQYXJhbXMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgICAgaWYgKCFza2lwSWZFeGlzdHMgfHwgIXBhcmFtc1RvVXBkYXRlLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgcGFyYW1zVG9VcGRhdGVbbmFtZV0gPSBpbnRlcnBvbGF0ZVBhcmFtcyhuZXdQYXJhbXNbbmFtZV0sIHBhcmFtc1RvVXBkYXRlLCB0aGlzLmVycm9ycyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2NvcHlPcHRpb25zKCkge1xuICAgIGNvbnN0IG9wdGlvbnM6IEFuaW1hdGlvbk9wdGlvbnMgPSB7fTtcbiAgICBpZiAodGhpcy5vcHRpb25zKSB7XG4gICAgICBjb25zdCBvbGRQYXJhbXMgPSB0aGlzLm9wdGlvbnMucGFyYW1zO1xuICAgICAgaWYgKG9sZFBhcmFtcykge1xuICAgICAgICBjb25zdCBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogYW55fSA9IChvcHRpb25zWydwYXJhbXMnXSA9IHt9KTtcbiAgICAgICAgT2JqZWN0LmtleXMob2xkUGFyYW1zKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICAgICAgcGFyYW1zW25hbWVdID0gb2xkUGFyYW1zW25hbWVdO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cblxuICBjcmVhdGVTdWJDb250ZXh0KFxuICAgIG9wdGlvbnM6IEFuaW1hdGlvbk9wdGlvbnMgfCBudWxsID0gbnVsbCxcbiAgICBlbGVtZW50PzogYW55LFxuICAgIG5ld1RpbWU/OiBudW1iZXIsXG4gICk6IEFuaW1hdGlvblRpbWVsaW5lQ29udGV4dCB7XG4gICAgY29uc3QgdGFyZ2V0ID0gZWxlbWVudCB8fCB0aGlzLmVsZW1lbnQ7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBBbmltYXRpb25UaW1lbGluZUNvbnRleHQoXG4gICAgICB0aGlzLl9kcml2ZXIsXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1Ykluc3RydWN0aW9ucyxcbiAgICAgIHRoaXMuX2VudGVyQ2xhc3NOYW1lLFxuICAgICAgdGhpcy5fbGVhdmVDbGFzc05hbWUsXG4gICAgICB0aGlzLmVycm9ycyxcbiAgICAgIHRoaXMudGltZWxpbmVzLFxuICAgICAgdGhpcy5jdXJyZW50VGltZWxpbmUuZm9yayh0YXJnZXQsIG5ld1RpbWUgfHwgMCksXG4gICAgKTtcbiAgICBjb250ZXh0LnByZXZpb3VzTm9kZSA9IHRoaXMucHJldmlvdXNOb2RlO1xuICAgIGNvbnRleHQuY3VycmVudEFuaW1hdGVUaW1pbmdzID0gdGhpcy5jdXJyZW50QW5pbWF0ZVRpbWluZ3M7XG5cbiAgICBjb250ZXh0Lm9wdGlvbnMgPSB0aGlzLl9jb3B5T3B0aW9ucygpO1xuICAgIGNvbnRleHQudXBkYXRlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgIGNvbnRleHQuY3VycmVudFF1ZXJ5SW5kZXggPSB0aGlzLmN1cnJlbnRRdWVyeUluZGV4O1xuICAgIGNvbnRleHQuY3VycmVudFF1ZXJ5VG90YWwgPSB0aGlzLmN1cnJlbnRRdWVyeVRvdGFsO1xuICAgIGNvbnRleHQucGFyZW50Q29udGV4dCA9IHRoaXM7XG4gICAgdGhpcy5zdWJDb250ZXh0Q291bnQrKztcbiAgICByZXR1cm4gY29udGV4dDtcbiAgfVxuXG4gIHRyYW5zZm9ybUludG9OZXdUaW1lbGluZShuZXdUaW1lPzogbnVtYmVyKSB7XG4gICAgdGhpcy5wcmV2aW91c05vZGUgPSBERUZBVUxUX05PT1BfUFJFVklPVVNfTk9ERTtcbiAgICB0aGlzLmN1cnJlbnRUaW1lbGluZSA9IHRoaXMuY3VycmVudFRpbWVsaW5lLmZvcmsodGhpcy5lbGVtZW50LCBuZXdUaW1lKTtcbiAgICB0aGlzLnRpbWVsaW5lcy5wdXNoKHRoaXMuY3VycmVudFRpbWVsaW5lKTtcbiAgICByZXR1cm4gdGhpcy5jdXJyZW50VGltZWxpbmU7XG4gIH1cblxuICBhcHBlbmRJbnN0cnVjdGlvblRvVGltZWxpbmUoXG4gICAgaW5zdHJ1Y3Rpb246IEFuaW1hdGlvblRpbWVsaW5lSW5zdHJ1Y3Rpb24sXG4gICAgZHVyYXRpb246IG51bWJlciB8IG51bGwsXG4gICAgZGVsYXk6IG51bWJlciB8IG51bGwsXG4gICk6IEFuaW1hdGVUaW1pbmdzIHtcbiAgICBjb25zdCB1cGRhdGVkVGltaW5nczogQW5pbWF0ZVRpbWluZ3MgPSB7XG4gICAgICBkdXJhdGlvbjogZHVyYXRpb24gIT0gbnVsbCA/IGR1cmF0aW9uIDogaW5zdHJ1Y3Rpb24uZHVyYXRpb24sXG4gICAgICBkZWxheTogdGhpcy5jdXJyZW50VGltZWxpbmUuY3VycmVudFRpbWUgKyAoZGVsYXkgIT0gbnVsbCA/IGRlbGF5IDogMCkgKyBpbnN0cnVjdGlvbi5kZWxheSxcbiAgICAgIGVhc2luZzogJycsXG4gICAgfTtcbiAgICBjb25zdCBidWlsZGVyID0gbmV3IFN1YlRpbWVsaW5lQnVpbGRlcihcbiAgICAgIHRoaXMuX2RyaXZlcixcbiAgICAgIGluc3RydWN0aW9uLmVsZW1lbnQsXG4gICAgICBpbnN0cnVjdGlvbi5rZXlmcmFtZXMsXG4gICAgICBpbnN0cnVjdGlvbi5wcmVTdHlsZVByb3BzLFxuICAgICAgaW5zdHJ1Y3Rpb24ucG9zdFN0eWxlUHJvcHMsXG4gICAgICB1cGRhdGVkVGltaW5ncyxcbiAgICAgIGluc3RydWN0aW9uLnN0cmV0Y2hTdGFydGluZ0tleWZyYW1lLFxuICAgICk7XG4gICAgdGhpcy50aW1lbGluZXMucHVzaChidWlsZGVyKTtcbiAgICByZXR1cm4gdXBkYXRlZFRpbWluZ3M7XG4gIH1cblxuICBpbmNyZW1lbnRUaW1lKHRpbWU6IG51bWJlcikge1xuICAgIHRoaXMuY3VycmVudFRpbWVsaW5lLmZvcndhcmRUaW1lKHRoaXMuY3VycmVudFRpbWVsaW5lLmR1cmF0aW9uICsgdGltZSk7XG4gIH1cblxuICBkZWxheU5leHRTdGVwKGRlbGF5OiBudW1iZXIpIHtcbiAgICAvLyBuZWdhdGl2ZSBkZWxheXMgYXJlIG5vdCB5ZXQgc3VwcG9ydGVkXG4gICAgaWYgKGRlbGF5ID4gMCkge1xuICAgICAgdGhpcy5jdXJyZW50VGltZWxpbmUuZGVsYXlOZXh0U3RlcChkZWxheSk7XG4gICAgfVxuICB9XG5cbiAgaW52b2tlUXVlcnkoXG4gICAgc2VsZWN0b3I6IHN0cmluZyxcbiAgICBvcmlnaW5hbFNlbGVjdG9yOiBzdHJpbmcsXG4gICAgbGltaXQ6IG51bWJlcixcbiAgICBpbmNsdWRlU2VsZjogYm9vbGVhbixcbiAgICBvcHRpb25hbDogYm9vbGVhbixcbiAgICBlcnJvcnM6IEVycm9yW10sXG4gICk6IGFueVtdIHtcbiAgICBsZXQgcmVzdWx0czogYW55W10gPSBbXTtcbiAgICBpZiAoaW5jbHVkZVNlbGYpIHtcbiAgICAgIHJlc3VsdHMucHVzaCh0aGlzLmVsZW1lbnQpO1xuICAgIH1cbiAgICBpZiAoc2VsZWN0b3IubGVuZ3RoID4gMCkge1xuICAgICAgLy8gb25seSBpZiA6c2VsZiBpcyB1c2VkIHRoZW4gdGhlIHNlbGVjdG9yIGNhbiBiZSBlbXB0eVxuICAgICAgc2VsZWN0b3IgPSBzZWxlY3Rvci5yZXBsYWNlKEVOVEVSX1RPS0VOX1JFR0VYLCAnLicgKyB0aGlzLl9lbnRlckNsYXNzTmFtZSk7XG4gICAgICBzZWxlY3RvciA9IHNlbGVjdG9yLnJlcGxhY2UoTEVBVkVfVE9LRU5fUkVHRVgsICcuJyArIHRoaXMuX2xlYXZlQ2xhc3NOYW1lKTtcbiAgICAgIGNvbnN0IG11bHRpID0gbGltaXQgIT0gMTtcbiAgICAgIGxldCBlbGVtZW50cyA9IHRoaXMuX2RyaXZlci5xdWVyeSh0aGlzLmVsZW1lbnQsIHNlbGVjdG9yLCBtdWx0aSk7XG4gICAgICBpZiAobGltaXQgIT09IDApIHtcbiAgICAgICAgZWxlbWVudHMgPVxuICAgICAgICAgIGxpbWl0IDwgMFxuICAgICAgICAgICAgPyBlbGVtZW50cy5zbGljZShlbGVtZW50cy5sZW5ndGggKyBsaW1pdCwgZWxlbWVudHMubGVuZ3RoKVxuICAgICAgICAgICAgOiBlbGVtZW50cy5zbGljZSgwLCBsaW1pdCk7XG4gICAgICB9XG4gICAgICByZXN1bHRzLnB1c2goLi4uZWxlbWVudHMpO1xuICAgIH1cblxuICAgIGlmICghb3B0aW9uYWwgJiYgcmVzdWx0cy5sZW5ndGggPT0gMCkge1xuICAgICAgZXJyb3JzLnB1c2goaW52YWxpZFF1ZXJ5KG9yaWdpbmFsU2VsZWN0b3IpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRpbWVsaW5lQnVpbGRlciB7XG4gIHB1YmxpYyBkdXJhdGlvbjogbnVtYmVyID0gMDtcbiAgcHVibGljIGVhc2luZzogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX3ByZXZpb3VzS2V5ZnJhbWU6IMm1U3R5bGVEYXRhTWFwID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIF9jdXJyZW50S2V5ZnJhbWU6IMm1U3R5bGVEYXRhTWFwID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIF9rZXlmcmFtZXMgPSBuZXcgTWFwPG51bWJlciwgybVTdHlsZURhdGFNYXA+KCk7XG4gIHByaXZhdGUgX3N0eWxlU3VtbWFyeSA9IG5ldyBNYXA8c3RyaW5nLCBTdHlsZUF0VGltZT4oKTtcbiAgcHJpdmF0ZSBfbG9jYWxUaW1lbGluZVN0eWxlczogybVTdHlsZURhdGFNYXAgPSBuZXcgTWFwKCk7XG4gIHByaXZhdGUgX2dsb2JhbFRpbWVsaW5lU3R5bGVzOiDJtVN0eWxlRGF0YU1hcDtcbiAgcHJpdmF0ZSBfcGVuZGluZ1N0eWxlczogybVTdHlsZURhdGFNYXAgPSBuZXcgTWFwKCk7XG4gIHByaXZhdGUgX2JhY2tGaWxsOiDJtVN0eWxlRGF0YU1hcCA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBfY3VycmVudEVtcHR5U3RlcEtleWZyYW1lOiDJtVN0eWxlRGF0YU1hcCB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgX2RyaXZlcjogQW5pbWF0aW9uRHJpdmVyLFxuICAgIHB1YmxpYyBlbGVtZW50OiBhbnksXG4gICAgcHVibGljIHN0YXJ0VGltZTogbnVtYmVyLFxuICAgIHByaXZhdGUgX2VsZW1lbnRUaW1lbGluZVN0eWxlc0xvb2t1cD86IE1hcDxhbnksIMm1U3R5bGVEYXRhTWFwPixcbiAgKSB7XG4gICAgaWYgKCF0aGlzLl9lbGVtZW50VGltZWxpbmVTdHlsZXNMb29rdXApIHtcbiAgICAgIHRoaXMuX2VsZW1lbnRUaW1lbGluZVN0eWxlc0xvb2t1cCA9IG5ldyBNYXA8YW55LCDJtVN0eWxlRGF0YU1hcD4oKTtcbiAgICB9XG5cbiAgICB0aGlzLl9nbG9iYWxUaW1lbGluZVN0eWxlcyA9IHRoaXMuX2VsZW1lbnRUaW1lbGluZVN0eWxlc0xvb2t1cC5nZXQoZWxlbWVudCkhO1xuICAgIGlmICghdGhpcy5fZ2xvYmFsVGltZWxpbmVTdHlsZXMpIHtcbiAgICAgIHRoaXMuX2dsb2JhbFRpbWVsaW5lU3R5bGVzID0gdGhpcy5fbG9jYWxUaW1lbGluZVN0eWxlcztcbiAgICAgIHRoaXMuX2VsZW1lbnRUaW1lbGluZVN0eWxlc0xvb2t1cC5zZXQoZWxlbWVudCwgdGhpcy5fbG9jYWxUaW1lbGluZVN0eWxlcyk7XG4gICAgfVxuICAgIHRoaXMuX2xvYWRLZXlmcmFtZSgpO1xuICB9XG5cbiAgY29udGFpbnNBbmltYXRpb24oKTogYm9vbGVhbiB7XG4gICAgc3dpdGNoICh0aGlzLl9rZXlmcmFtZXMuc2l6ZSkge1xuICAgICAgY2FzZSAwOlxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICBjYXNlIDE6XG4gICAgICAgIHJldHVybiB0aGlzLmhhc0N1cnJlbnRTdHlsZVByb3BlcnRpZXMoKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGhhc0N1cnJlbnRTdHlsZVByb3BlcnRpZXMoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRLZXlmcmFtZS5zaXplID4gMDtcbiAgfVxuXG4gIGdldCBjdXJyZW50VGltZSgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGFydFRpbWUgKyB0aGlzLmR1cmF0aW9uO1xuICB9XG5cbiAgZGVsYXlOZXh0U3RlcChkZWxheTogbnVtYmVyKSB7XG4gICAgLy8gaW4gdGhlIGV2ZW50IHRoYXQgYSBzdHlsZSgpIHN0ZXAgaXMgcGxhY2VkIHJpZ2h0IGJlZm9yZSBhIHN0YWdnZXIoKVxuICAgIC8vIGFuZCB0aGF0IHN0eWxlKCkgc3RlcCBpcyB0aGUgdmVyeSBmaXJzdCBzdHlsZSgpIHZhbHVlIGluIHRoZSBhbmltYXRpb25cbiAgICAvLyB0aGVuIHdlIG5lZWQgdG8gbWFrZSBhIGNvcHkgb2YgdGhlIGtleWZyYW1lIFswLCBjb3B5LCAxXSBzbyB0aGF0IHRoZSBkZWxheVxuICAgIC8vIHByb3Blcmx5IGFwcGxpZXMgdGhlIHN0eWxlKCkgdmFsdWVzIHRvIHdvcmsgd2l0aCB0aGUgc3RhZ2dlci4uLlxuICAgIGNvbnN0IGhhc1ByZVN0eWxlU3RlcCA9IHRoaXMuX2tleWZyYW1lcy5zaXplID09PSAxICYmIHRoaXMuX3BlbmRpbmdTdHlsZXMuc2l6ZTtcblxuICAgIGlmICh0aGlzLmR1cmF0aW9uIHx8IGhhc1ByZVN0eWxlU3RlcCkge1xuICAgICAgdGhpcy5mb3J3YXJkVGltZSh0aGlzLmN1cnJlbnRUaW1lICsgZGVsYXkpO1xuICAgICAgaWYgKGhhc1ByZVN0eWxlU3RlcCkge1xuICAgICAgICB0aGlzLnNuYXBzaG90Q3VycmVudFN0eWxlcygpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnN0YXJ0VGltZSArPSBkZWxheTtcbiAgICB9XG4gIH1cblxuICBmb3JrKGVsZW1lbnQ6IGFueSwgY3VycmVudFRpbWU/OiBudW1iZXIpOiBUaW1lbGluZUJ1aWxkZXIge1xuICAgIHRoaXMuYXBwbHlTdHlsZXNUb0tleWZyYW1lKCk7XG4gICAgcmV0dXJuIG5ldyBUaW1lbGluZUJ1aWxkZXIoXG4gICAgICB0aGlzLl9kcml2ZXIsXG4gICAgICBlbGVtZW50LFxuICAgICAgY3VycmVudFRpbWUgfHwgdGhpcy5jdXJyZW50VGltZSxcbiAgICAgIHRoaXMuX2VsZW1lbnRUaW1lbGluZVN0eWxlc0xvb2t1cCxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBfbG9hZEtleWZyYW1lKCkge1xuICAgIGlmICh0aGlzLl9jdXJyZW50S2V5ZnJhbWUpIHtcbiAgICAgIHRoaXMuX3ByZXZpb3VzS2V5ZnJhbWUgPSB0aGlzLl9jdXJyZW50S2V5ZnJhbWU7XG4gICAgfVxuICAgIHRoaXMuX2N1cnJlbnRLZXlmcmFtZSA9IHRoaXMuX2tleWZyYW1lcy5nZXQodGhpcy5kdXJhdGlvbikhO1xuICAgIGlmICghdGhpcy5fY3VycmVudEtleWZyYW1lKSB7XG4gICAgICB0aGlzLl9jdXJyZW50S2V5ZnJhbWUgPSBuZXcgTWFwKCk7XG4gICAgICB0aGlzLl9rZXlmcmFtZXMuc2V0KHRoaXMuZHVyYXRpb24sIHRoaXMuX2N1cnJlbnRLZXlmcmFtZSk7XG4gICAgfVxuICB9XG5cbiAgZm9yd2FyZEZyYW1lKCkge1xuICAgIHRoaXMuZHVyYXRpb24gKz0gT05FX0ZSQU1FX0lOX01JTExJU0VDT05EUztcbiAgICB0aGlzLl9sb2FkS2V5ZnJhbWUoKTtcbiAgfVxuXG4gIGZvcndhcmRUaW1lKHRpbWU6IG51bWJlcikge1xuICAgIHRoaXMuYXBwbHlTdHlsZXNUb0tleWZyYW1lKCk7XG4gICAgdGhpcy5kdXJhdGlvbiA9IHRpbWU7XG4gICAgdGhpcy5fbG9hZEtleWZyYW1lKCk7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVTdHlsZShwcm9wOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgICB0aGlzLl9sb2NhbFRpbWVsaW5lU3R5bGVzLnNldChwcm9wLCB2YWx1ZSk7XG4gICAgdGhpcy5fZ2xvYmFsVGltZWxpbmVTdHlsZXMuc2V0KHByb3AsIHZhbHVlKTtcbiAgICB0aGlzLl9zdHlsZVN1bW1hcnkuc2V0KHByb3AsIHt0aW1lOiB0aGlzLmN1cnJlbnRUaW1lLCB2YWx1ZX0pO1xuICB9XG5cbiAgYWxsb3dPbmx5VGltZWxpbmVTdHlsZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRFbXB0eVN0ZXBLZXlmcmFtZSAhPT0gdGhpcy5fY3VycmVudEtleWZyYW1lO1xuICB9XG5cbiAgYXBwbHlFbXB0eVN0ZXAoZWFzaW5nOiBzdHJpbmcgfCBudWxsKSB7XG4gICAgaWYgKGVhc2luZykge1xuICAgICAgdGhpcy5fcHJldmlvdXNLZXlmcmFtZS5zZXQoJ2Vhc2luZycsIGVhc2luZyk7XG4gICAgfVxuXG4gICAgLy8gc3BlY2lhbCBjYXNlIGZvciBhbmltYXRlKGR1cmF0aW9uKTpcbiAgICAvLyBhbGwgbWlzc2luZyBzdHlsZXMgYXJlIGZpbGxlZCB3aXRoIGEgYCpgIHZhbHVlIHRoZW5cbiAgICAvLyBpZiBhbnkgZGVzdGluYXRpb24gc3R5bGVzIGFyZSBmaWxsZWQgaW4gbGF0ZXIgb24gdGhlIHNhbWVcbiAgICAvLyBrZXlmcmFtZSB0aGVuIHRoZXkgd2lsbCBvdmVycmlkZSB0aGUgb3ZlcnJpZGRlbiBzdHlsZXNcbiAgICAvLyBXZSB1c2UgYF9nbG9iYWxUaW1lbGluZVN0eWxlc2AgaGVyZSBiZWNhdXNlIHRoZXJlIG1heSBiZVxuICAgIC8vIHN0eWxlcyBpbiBwcmV2aW91cyBrZXlmcmFtZXMgdGhhdCBhcmUgbm90IHByZXNlbnQgaW4gdGhpcyB0aW1lbGluZVxuICAgIGZvciAobGV0IFtwcm9wLCB2YWx1ZV0gb2YgdGhpcy5fZ2xvYmFsVGltZWxpbmVTdHlsZXMpIHtcbiAgICAgIHRoaXMuX2JhY2tGaWxsLnNldChwcm9wLCB2YWx1ZSB8fCBBVVRPX1NUWUxFKTtcbiAgICAgIHRoaXMuX2N1cnJlbnRLZXlmcmFtZS5zZXQocHJvcCwgQVVUT19TVFlMRSk7XG4gICAgfVxuICAgIHRoaXMuX2N1cnJlbnRFbXB0eVN0ZXBLZXlmcmFtZSA9IHRoaXMuX2N1cnJlbnRLZXlmcmFtZTtcbiAgfVxuXG4gIHNldFN0eWxlcyhcbiAgICBpbnB1dDogQXJyYXk8ybVTdHlsZURhdGFNYXAgfCBzdHJpbmc+LFxuICAgIGVhc2luZzogc3RyaW5nIHwgbnVsbCxcbiAgICBlcnJvcnM6IEVycm9yW10sXG4gICAgb3B0aW9ucz86IEFuaW1hdGlvbk9wdGlvbnMsXG4gICkge1xuICAgIGlmIChlYXNpbmcpIHtcbiAgICAgIHRoaXMuX3ByZXZpb3VzS2V5ZnJhbWUuc2V0KCdlYXNpbmcnLCBlYXNpbmcpO1xuICAgIH1cbiAgICBjb25zdCBwYXJhbXMgPSAob3B0aW9ucyAmJiBvcHRpb25zLnBhcmFtcykgfHwge307XG4gICAgY29uc3Qgc3R5bGVzID0gZmxhdHRlblN0eWxlcyhpbnB1dCwgdGhpcy5fZ2xvYmFsVGltZWxpbmVTdHlsZXMpO1xuICAgIGZvciAobGV0IFtwcm9wLCB2YWx1ZV0gb2Ygc3R5bGVzKSB7XG4gICAgICBjb25zdCB2YWwgPSBpbnRlcnBvbGF0ZVBhcmFtcyh2YWx1ZSwgcGFyYW1zLCBlcnJvcnMpO1xuICAgICAgdGhpcy5fcGVuZGluZ1N0eWxlcy5zZXQocHJvcCwgdmFsKTtcbiAgICAgIGlmICghdGhpcy5fbG9jYWxUaW1lbGluZVN0eWxlcy5oYXMocHJvcCkpIHtcbiAgICAgICAgdGhpcy5fYmFja0ZpbGwuc2V0KHByb3AsIHRoaXMuX2dsb2JhbFRpbWVsaW5lU3R5bGVzLmdldChwcm9wKSA/PyBBVVRPX1NUWUxFKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3VwZGF0ZVN0eWxlKHByb3AsIHZhbCk7XG4gICAgfVxuICB9XG5cbiAgYXBwbHlTdHlsZXNUb0tleWZyYW1lKCkge1xuICAgIGlmICh0aGlzLl9wZW5kaW5nU3R5bGVzLnNpemUgPT0gMCkgcmV0dXJuO1xuXG4gICAgdGhpcy5fcGVuZGluZ1N0eWxlcy5mb3JFYWNoKCh2YWwsIHByb3ApID0+IHtcbiAgICAgIHRoaXMuX2N1cnJlbnRLZXlmcmFtZS5zZXQocHJvcCwgdmFsKTtcbiAgICB9KTtcbiAgICB0aGlzLl9wZW5kaW5nU3R5bGVzLmNsZWFyKCk7XG5cbiAgICB0aGlzLl9sb2NhbFRpbWVsaW5lU3R5bGVzLmZvckVhY2goKHZhbCwgcHJvcCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLl9jdXJyZW50S2V5ZnJhbWUuaGFzKHByb3ApKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRLZXlmcmFtZS5zZXQocHJvcCwgdmFsKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNuYXBzaG90Q3VycmVudFN0eWxlcygpIHtcbiAgICBmb3IgKGxldCBbcHJvcCwgdmFsXSBvZiB0aGlzLl9sb2NhbFRpbWVsaW5lU3R5bGVzKSB7XG4gICAgICB0aGlzLl9wZW5kaW5nU3R5bGVzLnNldChwcm9wLCB2YWwpO1xuICAgICAgdGhpcy5fdXBkYXRlU3R5bGUocHJvcCwgdmFsKTtcbiAgICB9XG4gIH1cblxuICBnZXRGaW5hbEtleWZyYW1lKCkge1xuICAgIHJldHVybiB0aGlzLl9rZXlmcmFtZXMuZ2V0KHRoaXMuZHVyYXRpb24pO1xuICB9XG5cbiAgZ2V0IHByb3BlcnRpZXMoKSB7XG4gICAgY29uc3QgcHJvcGVydGllczogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGxldCBwcm9wIGluIHRoaXMuX2N1cnJlbnRLZXlmcmFtZSkge1xuICAgICAgcHJvcGVydGllcy5wdXNoKHByb3ApO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcGVydGllcztcbiAgfVxuXG4gIG1lcmdlVGltZWxpbmVDb2xsZWN0ZWRTdHlsZXModGltZWxpbmU6IFRpbWVsaW5lQnVpbGRlcikge1xuICAgIHRpbWVsaW5lLl9zdHlsZVN1bW1hcnkuZm9yRWFjaCgoZGV0YWlsczEsIHByb3ApID0+IHtcbiAgICAgIGNvbnN0IGRldGFpbHMwID0gdGhpcy5fc3R5bGVTdW1tYXJ5LmdldChwcm9wKTtcbiAgICAgIGlmICghZGV0YWlsczAgfHwgZGV0YWlsczEudGltZSA+IGRldGFpbHMwLnRpbWUpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlU3R5bGUocHJvcCwgZGV0YWlsczEudmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgYnVpbGRLZXlmcmFtZXMoKTogQW5pbWF0aW9uVGltZWxpbmVJbnN0cnVjdGlvbiB7XG4gICAgdGhpcy5hcHBseVN0eWxlc1RvS2V5ZnJhbWUoKTtcbiAgICBjb25zdCBwcmVTdHlsZVByb3BzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgcG9zdFN0eWxlUHJvcHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBpc0VtcHR5ID0gdGhpcy5fa2V5ZnJhbWVzLnNpemUgPT09IDEgJiYgdGhpcy5kdXJhdGlvbiA9PT0gMDtcblxuICAgIGxldCBmaW5hbEtleWZyYW1lczogQXJyYXk8ybVTdHlsZURhdGFNYXA+ID0gW107XG4gICAgdGhpcy5fa2V5ZnJhbWVzLmZvckVhY2goKGtleWZyYW1lLCB0aW1lKSA9PiB7XG4gICAgICBjb25zdCBmaW5hbEtleWZyYW1lID0gbmV3IE1hcChbLi4udGhpcy5fYmFja0ZpbGwsIC4uLmtleWZyYW1lXSk7XG4gICAgICBmaW5hbEtleWZyYW1lLmZvckVhY2goKHZhbHVlLCBwcm9wKSA9PiB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gUFJFX1NUWUxFKSB7XG4gICAgICAgICAgcHJlU3R5bGVQcm9wcy5hZGQocHJvcCk7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IEFVVE9fU1RZTEUpIHtcbiAgICAgICAgICBwb3N0U3R5bGVQcm9wcy5hZGQocHJvcCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCFpc0VtcHR5KSB7XG4gICAgICAgIGZpbmFsS2V5ZnJhbWUuc2V0KCdvZmZzZXQnLCB0aW1lIC8gdGhpcy5kdXJhdGlvbik7XG4gICAgICB9XG4gICAgICBmaW5hbEtleWZyYW1lcy5wdXNoKGZpbmFsS2V5ZnJhbWUpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgcHJlUHJvcHM6IHN0cmluZ1tdID0gWy4uLnByZVN0eWxlUHJvcHMudmFsdWVzKCldO1xuICAgIGNvbnN0IHBvc3RQcm9wczogc3RyaW5nW10gPSBbLi4ucG9zdFN0eWxlUHJvcHMudmFsdWVzKCldO1xuXG4gICAgLy8gc3BlY2lhbCBjYXNlIGZvciBhIDAtc2Vjb25kIGFuaW1hdGlvbiAod2hpY2ggaXMgZGVzaWduZWQganVzdCB0byBwbGFjZSBzdHlsZXMgb25zY3JlZW4pXG4gICAgaWYgKGlzRW1wdHkpIHtcbiAgICAgIGNvbnN0IGtmMCA9IGZpbmFsS2V5ZnJhbWVzWzBdO1xuICAgICAgY29uc3Qga2YxID0gbmV3IE1hcChrZjApO1xuICAgICAga2YwLnNldCgnb2Zmc2V0JywgMCk7XG4gICAgICBrZjEuc2V0KCdvZmZzZXQnLCAxKTtcbiAgICAgIGZpbmFsS2V5ZnJhbWVzID0gW2tmMCwga2YxXTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlVGltZWxpbmVJbnN0cnVjdGlvbihcbiAgICAgIHRoaXMuZWxlbWVudCxcbiAgICAgIGZpbmFsS2V5ZnJhbWVzLFxuICAgICAgcHJlUHJvcHMsXG4gICAgICBwb3N0UHJvcHMsXG4gICAgICB0aGlzLmR1cmF0aW9uLFxuICAgICAgdGhpcy5zdGFydFRpbWUsXG4gICAgICB0aGlzLmVhc2luZyxcbiAgICAgIGZhbHNlLFxuICAgICk7XG4gIH1cbn1cblxuY2xhc3MgU3ViVGltZWxpbmVCdWlsZGVyIGV4dGVuZHMgVGltZWxpbmVCdWlsZGVyIHtcbiAgcHVibGljIHRpbWluZ3M6IEFuaW1hdGVUaW1pbmdzO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGRyaXZlcjogQW5pbWF0aW9uRHJpdmVyLFxuICAgIGVsZW1lbnQ6IGFueSxcbiAgICBwdWJsaWMga2V5ZnJhbWVzOiBBcnJheTzJtVN0eWxlRGF0YU1hcD4sXG4gICAgcHVibGljIHByZVN0eWxlUHJvcHM6IHN0cmluZ1tdLFxuICAgIHB1YmxpYyBwb3N0U3R5bGVQcm9wczogc3RyaW5nW10sXG4gICAgdGltaW5nczogQW5pbWF0ZVRpbWluZ3MsXG4gICAgcHJpdmF0ZSBfc3RyZXRjaFN0YXJ0aW5nS2V5ZnJhbWU6IGJvb2xlYW4gPSBmYWxzZSxcbiAgKSB7XG4gICAgc3VwZXIoZHJpdmVyLCBlbGVtZW50LCB0aW1pbmdzLmRlbGF5KTtcbiAgICB0aGlzLnRpbWluZ3MgPSB7ZHVyYXRpb246IHRpbWluZ3MuZHVyYXRpb24sIGRlbGF5OiB0aW1pbmdzLmRlbGF5LCBlYXNpbmc6IHRpbWluZ3MuZWFzaW5nfTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNvbnRhaW5zQW5pbWF0aW9uKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmtleWZyYW1lcy5sZW5ndGggPiAxO1xuICB9XG5cbiAgb3ZlcnJpZGUgYnVpbGRLZXlmcmFtZXMoKTogQW5pbWF0aW9uVGltZWxpbmVJbnN0cnVjdGlvbiB7XG4gICAgbGV0IGtleWZyYW1lcyA9IHRoaXMua2V5ZnJhbWVzO1xuICAgIGxldCB7ZGVsYXksIGR1cmF0aW9uLCBlYXNpbmd9ID0gdGhpcy50aW1pbmdzO1xuICAgIGlmICh0aGlzLl9zdHJldGNoU3RhcnRpbmdLZXlmcmFtZSAmJiBkZWxheSkge1xuICAgICAgY29uc3QgbmV3S2V5ZnJhbWVzOiBBcnJheTzJtVN0eWxlRGF0YU1hcD4gPSBbXTtcbiAgICAgIGNvbnN0IHRvdGFsVGltZSA9IGR1cmF0aW9uICsgZGVsYXk7XG4gICAgICBjb25zdCBzdGFydGluZ0dhcCA9IGRlbGF5IC8gdG90YWxUaW1lO1xuXG4gICAgICAvLyB0aGUgb3JpZ2luYWwgc3RhcnRpbmcga2V5ZnJhbWUgbm93IHN0YXJ0cyBvbmNlIHRoZSBkZWxheSBpcyBkb25lXG4gICAgICBjb25zdCBuZXdGaXJzdEtleWZyYW1lID0gbmV3IE1hcChrZXlmcmFtZXNbMF0pO1xuICAgICAgbmV3Rmlyc3RLZXlmcmFtZS5zZXQoJ29mZnNldCcsIDApO1xuICAgICAgbmV3S2V5ZnJhbWVzLnB1c2gobmV3Rmlyc3RLZXlmcmFtZSk7XG5cbiAgICAgIGNvbnN0IG9sZEZpcnN0S2V5ZnJhbWUgPSBuZXcgTWFwKGtleWZyYW1lc1swXSk7XG4gICAgICBvbGRGaXJzdEtleWZyYW1lLnNldCgnb2Zmc2V0Jywgcm91bmRPZmZzZXQoc3RhcnRpbmdHYXApKTtcbiAgICAgIG5ld0tleWZyYW1lcy5wdXNoKG9sZEZpcnN0S2V5ZnJhbWUpO1xuXG4gICAgICAvKlxuICAgICAgICBXaGVuIHRoZSBrZXlmcmFtZSBpcyBzdHJldGNoZWQgdGhlbiBpdCBtZWFucyB0aGF0IHRoZSBkZWxheSBiZWZvcmUgdGhlIGFuaW1hdGlvblxuICAgICAgICBzdGFydHMgaXMgZ29uZS4gSW5zdGVhZCB0aGUgZmlyc3Qga2V5ZnJhbWUgaXMgcGxhY2VkIGF0IHRoZSBzdGFydCBvZiB0aGUgYW5pbWF0aW9uXG4gICAgICAgIGFuZCBpdCBpcyB0aGVuIGNvcGllZCB0byB3aGVyZSBpdCBzdGFydHMgd2hlbiB0aGUgb3JpZ2luYWwgZGVsYXkgaXMgb3Zlci4gVGhpcyBiYXNpY2FsbHlcbiAgICAgICAgbWVhbnMgbm90aGluZyBhbmltYXRlcyBkdXJpbmcgdGhhdCBkZWxheSwgYnV0IHRoZSBzdHlsZXMgYXJlIHN0aWxsIHJlbmRlcmVkLiBGb3IgdGhpc1xuICAgICAgICB0byB3b3JrIHRoZSBvcmlnaW5hbCBvZmZzZXQgdmFsdWVzIHRoYXQgZXhpc3QgaW4gdGhlIG9yaWdpbmFsIGtleWZyYW1lcyBtdXN0IGJlIFwid2FycGVkXCJcbiAgICAgICAgc28gdGhhdCB0aGV5IGNhbiB0YWtlIHRoZSBuZXcga2V5ZnJhbWUgKyBkZWxheSBpbnRvIGFjY291bnQuXG5cbiAgICAgICAgZGVsYXk9MTAwMCwgZHVyYXRpb249MTAwMCwga2V5ZnJhbWVzID0gMCAuNSAxXG5cbiAgICAgICAgdHVybnMgaW50b1xuXG4gICAgICAgIGRlbGF5PTAsIGR1cmF0aW9uPTIwMDAsIGtleWZyYW1lcyA9IDAgLjMzIC42NiAxXG4gICAgICAgKi9cblxuICAgICAgLy8gb2Zmc2V0cyBiZXR3ZWVuIDEgLi4uIG4gLTEgYXJlIGFsbCB3YXJwZWQgYnkgdGhlIGtleWZyYW1lIHN0cmV0Y2hcbiAgICAgIGNvbnN0IGxpbWl0ID0ga2V5ZnJhbWVzLmxlbmd0aCAtIDE7XG4gICAgICBmb3IgKGxldCBpID0gMTsgaSA8PSBsaW1pdDsgaSsrKSB7XG4gICAgICAgIGxldCBrZiA9IG5ldyBNYXAoa2V5ZnJhbWVzW2ldKTtcbiAgICAgICAgY29uc3Qgb2xkT2Zmc2V0ID0ga2YuZ2V0KCdvZmZzZXQnKSBhcyBudW1iZXI7XG4gICAgICAgIGNvbnN0IHRpbWVBdEtleWZyYW1lID0gZGVsYXkgKyBvbGRPZmZzZXQgKiBkdXJhdGlvbjtcbiAgICAgICAga2Yuc2V0KCdvZmZzZXQnLCByb3VuZE9mZnNldCh0aW1lQXRLZXlmcmFtZSAvIHRvdGFsVGltZSkpO1xuICAgICAgICBuZXdLZXlmcmFtZXMucHVzaChrZik7XG4gICAgICB9XG5cbiAgICAgIC8vIHRoZSBuZXcgc3RhcnRpbmcga2V5ZnJhbWUgc2hvdWxkIGJlIGFkZGVkIGF0IHRoZSBzdGFydFxuICAgICAgZHVyYXRpb24gPSB0b3RhbFRpbWU7XG4gICAgICBkZWxheSA9IDA7XG4gICAgICBlYXNpbmcgPSAnJztcblxuICAgICAga2V5ZnJhbWVzID0gbmV3S2V5ZnJhbWVzO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVUaW1lbGluZUluc3RydWN0aW9uKFxuICAgICAgdGhpcy5lbGVtZW50LFxuICAgICAga2V5ZnJhbWVzLFxuICAgICAgdGhpcy5wcmVTdHlsZVByb3BzLFxuICAgICAgdGhpcy5wb3N0U3R5bGVQcm9wcyxcbiAgICAgIGR1cmF0aW9uLFxuICAgICAgZGVsYXksXG4gICAgICBlYXNpbmcsXG4gICAgICB0cnVlLFxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcm91bmRPZmZzZXQob2Zmc2V0OiBudW1iZXIsIGRlY2ltYWxQb2ludHMgPSAzKTogbnVtYmVyIHtcbiAgY29uc3QgbXVsdCA9IE1hdGgucG93KDEwLCBkZWNpbWFsUG9pbnRzIC0gMSk7XG4gIHJldHVybiBNYXRoLnJvdW5kKG9mZnNldCAqIG11bHQpIC8gbXVsdDtcbn1cblxuZnVuY3Rpb24gZmxhdHRlblN0eWxlcyhpbnB1dDogQXJyYXk8ybVTdHlsZURhdGFNYXAgfCBzdHJpbmc+LCBhbGxTdHlsZXM6IMm1U3R5bGVEYXRhTWFwKSB7XG4gIGNvbnN0IHN0eWxlczogybVTdHlsZURhdGFNYXAgPSBuZXcgTWFwKCk7XG4gIGxldCBhbGxQcm9wZXJ0aWVzOiBzdHJpbmdbXSB8IEl0ZXJhYmxlSXRlcmF0b3I8c3RyaW5nPjtcbiAgaW5wdXQuZm9yRWFjaCgodG9rZW4pID0+IHtcbiAgICBpZiAodG9rZW4gPT09ICcqJykge1xuICAgICAgYWxsUHJvcGVydGllcyA/Pz0gYWxsU3R5bGVzLmtleXMoKTtcbiAgICAgIGZvciAobGV0IHByb3Agb2YgYWxsUHJvcGVydGllcykge1xuICAgICAgICBzdHlsZXMuc2V0KHByb3AsIEFVVE9fU1RZTEUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGxldCBbcHJvcCwgdmFsXSBvZiB0b2tlbiBhcyDJtVN0eWxlRGF0YU1hcCkge1xuICAgICAgICBzdHlsZXMuc2V0KHByb3AsIHZhbCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHN0eWxlcztcbn1cbiJdfQ==