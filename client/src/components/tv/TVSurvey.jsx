import React, { useState, useEffect } from 'react'
import { analytics } from '../../services/analytics'

/**
 * TVSurvey - Simple, TV-like survey component
 * Minimal user control - just like watching TV
 * Appears after watching for a few minutes
 */

export default function TVSurvey({ isOpen, onClose, ageGroup = null }) {
	const [currentQuestion, setCurrentQuestion] = useState(0)
	const [answers, setAnswers] = useState({})
	const [isSubmitting, setIsSubmitting] = useState(false)
	
	// Simple questions - TV-like experience
	const questions = [
		{
			id: 'ease_of_use',
			text: 'How easy is it to use?',
			type: 'rating',
			options: [1, 2, 3, 4, 5],
			labels: ['Very Hard', 'Hard', 'Okay', 'Easy', 'Very Easy']
		},
		{
			id: 'satisfaction',
			text: 'How satisfied are you?',
			type: 'rating',
			options: [1, 2, 3, 4, 5],
			labels: ['Very Unsatisfied', 'Unsatisfied', 'Neutral', 'Satisfied', 'Very Satisfied']
		},
		{
			id: 'would_use',
			text: 'Would you use this regularly?',
			type: 'choice',
			options: ['Yes', 'Maybe', 'No']
		},
		{
			id: 'compared_to_tv',
			text: 'Compared to regular TV?',
			type: 'choice',
			options: ['Better', 'Same', 'Worse']
		}
	]
	
	// Age-specific questions
	const ageSpecificQuestions = {
		'18-30': [
			{
				id: 'nostalgia_appeal',
				text: 'Do you like the nostalgic TV design?',
				type: 'choice',
				options: ['Yes', 'No', 'Neutral']
			},
			{
				id: 'performance',
				text: 'Is performance acceptable?',
				type: 'choice',
				options: ['Yes', 'Needs Improvement', 'No']
			}
		],
		'31-50': [
			{
				id: 'familiarity',
				text: 'Does it feel familiar?',
				type: 'choice',
				options: ['Yes', 'Somewhat', 'No']
			},
			{
				id: 'family_use',
				text: 'Would you use this with family?',
				type: 'choice',
				options: ['Yes', 'Maybe', 'No']
			}
		],
		'51-60+': [
			{
				id: 'readability',
				text: 'Is the text readable?',
				type: 'choice',
				options: ['Yes', 'Somewhat', 'No']
			},
			{
				id: 'button_size',
				text: 'Are buttons large enough?',
				type: 'choice',
				options: ['Yes', 'Somewhat', 'No']
			}
		]
	}
	
	// Combine questions
	const allQuestions = [
		...questions,
		...(ageGroup && ageSpecificQuestions[ageGroup] ? ageSpecificQuestions[ageGroup] : [])
	]
	
	useEffect(() => {
		if (isOpen && ageGroup) {
			analytics.trackAgeGroup(ageGroup)
		}
	}, [isOpen, ageGroup])
	
	const handleAnswer = (questionId, answer) => {
		setAnswers(prev => ({
			...prev,
			[questionId]: answer
		}))
		
		// Auto-advance after short delay (TV-like)
		setTimeout(() => {
			if (currentQuestion < allQuestions.length - 1) {
				setCurrentQuestion(prev => prev + 1)
			} else {
				handleSubmit()
			}
		}, 500)
	}
	
	const handleSubmit = async () => {
		setIsSubmitting(true)
		
		// Track survey completion
		analytics.trackEvent('survey_completed', {
			ageGroup,
			answers,
			timestamp: Date.now()
		})
		
		// Send to backend (if endpoint exists)
		try {
			await fetch('/api/survey', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					ageGroup,
					answers,
					timestamp: Date.now()
				})
			})
		} catch (error) {
			console.warn('[Survey] Failed to submit:', error)
		}
		
		// Close after short delay
		setTimeout(() => {
			onClose()
			setIsSubmitting(false)
			setCurrentQuestion(0)
			setAnswers({})
		}, 1000)
	}
	
	const handleSkip = () => {
		analytics.trackEvent('survey_skipped', {
			ageGroup,
			timestamp: Date.now()
		})
		onClose()
	}
	
	if (!isOpen) return null
	
	const question = allQuestions[currentQuestion]
	const hasAnswered = answers[question.id] !== undefined
	
	return (
		<div className="tv-survey-overlay" onClick={(e) => e.stopPropagation()}>
			<div className="tv-survey">
				<div className="tv-survey-header">
					<h2>Quick Feedback</h2>
					<button className="tv-survey-close" onClick={handleSkip} aria-label="Skip">
						✕
					</button>
				</div>
				
				<div className="tv-survey-progress">
					<div 
						className="tv-survey-progress-bar" 
						style={{ width: `${((currentQuestion + 1) / allQuestions.length) * 100}%` }}
					/>
				</div>
				
				<div className="tv-survey-question">
					<p className="tv-survey-question-text">{question.text}</p>
					
					{question.type === 'rating' && (
						<div className="tv-survey-rating">
							{question.options.map((value, index) => (
								<button
									key={value}
									className={`tv-survey-button ${answers[question.id] === value ? 'selected' : ''}`}
									onClick={() => handleAnswer(question.id, value)}
									disabled={hasAnswered}
								>
									<span className="tv-survey-button-value">{value}</span>
									<span className="tv-survey-button-label">{question.labels[index]}</span>
								</button>
							))}
						</div>
					)}
					
					{question.type === 'choice' && (
						<div className="tv-survey-choices">
							{question.options.map((option) => (
								<button
									key={option}
									className={`tv-survey-button ${answers[question.id] === option ? 'selected' : ''}`}
									onClick={() => handleAnswer(question.id, option)}
									disabled={hasAnswered}
								>
									{option}
								</button>
							))}
						</div>
					)}
				</div>
				
				{isSubmitting && (
					<div className="tv-survey-submitting">
						<p>Thank you!</p>
					</div>
				)}
			</div>
		</div>
	)
}

